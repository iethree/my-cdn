import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import { hashPassword, PASSWORD_MAX, PASSWORD_MIN, verifyPassword } from "../shared/password";
import type { Plan } from "../shared/types";
import { userExists } from "./db";

export const planOf = (env: Env): Plan => ((env.PLAN as string) === "free" ? "free" : "paid");

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function createAuth(env: Env, origin: string) {
  const free = planOf(env) === "free";
  return betterAuth({
    appName: env.APP_NAME,
    baseURL: origin,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    database: {
      db: new Kysely<any>({ dialect: new D1Dialect({ database: env.DB }) }),
      type: "sqlite",
    },
    // Counters live in D1 so every isolate shares them (the default memory store is per isolate).
    rateLimit: { enabled: true, storage: "database" },
    // D1 blocks the introspection queries Kysely uses for schema validation.
    advanced: {
      database: { validateSchema: false },
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
    // Users are only ever created through /api/users or `bun run user:add`.
    databaseHooks: { user: { create: { before: async () => false } } },
    // Free plan: email + password (Email Sending isn't available). Paid plan: magic links only.
    emailAndPassword: free
      ? {
          enabled: true,
          disableSignUp: true,
          minPasswordLength: PASSWORD_MIN,
          maxPasswordLength: PASSWORD_MAX,
          password: { hash: hashPassword, verify: verifyPassword },
        }
      : undefined,
    plugins: free
      ? []
      : [
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
              const name = escapeHtml(env.APP_NAME);
              const href = escapeHtml(url);
              await env.EMAIL.send({
                to: email,
                from: { email: env.EMAIL_FROM, name: env.APP_NAME },
                subject: `Sign in to ${env.APP_NAME}`,
                text: `Open this link to sign in to ${env.APP_NAME}:\n\n${url}\n\nIt expires in 10 minutes. If you didn't request it, you can ignore this email.`,
                html: `<p>Open this link to sign in to <strong>${name}</strong>:</p><p><a href="${href}">${href}</a></p><p>It expires in 10 minutes. If you didn't request it, you can ignore this email.</p>`,
              });
            },
          }),
        ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
