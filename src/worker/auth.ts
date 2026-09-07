import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import { userExists } from "./db";

export function createAuth(env: Env, origin: string) {
  return betterAuth({
    appName: env.APP_NAME,
    baseURL: origin,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    database: {
      db: new Kysely<any>({ dialect: new D1Dialect({ database: env.DB }) }),
      type: "sqlite",
    },
    rateLimit: { enabled: true },
    // D1 blocks the introspection queries Kysely uses for schema validation.
    advanced: {
      database: { validateSchema: false },
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
    // Users are only ever created through /api/users or `bun run user:add`.
    databaseHooks: { user: { create: { before: async () => false } } },
    plugins: [
      magicLink({
        expiresIn: 60 * 10,
        storeToken: "hashed",
        disableSignUp: true,
        sendMagicLink: async ({ email, url }) => {
          // Silently skip unknown addresses so the login form never reveals who has access.
          if (!(await userExists(env.DB, email))) return;
          if (env.DEV_LOG_MAGIC_LINK === "1") {
            console.log(`[dev] magic link for ${email}: ${url}`);
            return;
          }
          await env.EMAIL.send({
            to: email,
            from: { email: env.EMAIL_FROM, name: env.APP_NAME },
            subject: `Sign in to ${env.APP_NAME}`,
            text: `Open this link to sign in to ${env.APP_NAME}:\n\n${url}\n\nIt expires in 10 minutes. If you didn't request it, you can ignore this email.`,
            html: `<p>Open this link to sign in to <strong>${env.APP_NAME}</strong>:</p><p><a href="${url}">${url}</a></p><p>It expires in 10 minutes. If you didn't request it, you can ignore this email.</p>`,
          });
        },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
