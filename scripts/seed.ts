// Usage: bun run user:add you@example.com [--password 'secret'] [--remote]
// Free-plan deployments sign in with a password, so pass one; paid deployments use magic links and don't need it.
import { hashPassword, PASSWORD_MAX, PASSWORD_MIN } from "../src/shared/password";

const q = (s: string) => s.replace(/'/g, "''");

export async function seedUser(email: string, remote: boolean, password?: string) {
  const now = new Date().toISOString();
  const target = remote ? "--remote" : "--local";
  const userSql = `INSERT OR IGNORE INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES ('${crypto.randomUUID()}', '${q(email.split("@")[0]!)}', '${q(email)}', 0, '${now}', '${now}');`;
  await Bun.$`bunx wrangler d1 execute DB ${target} --command ${userSql}`.quiet();
  if (password) {
    const hash = await hashPassword(password);
    const accountSql = `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") SELECT '${crypto.randomUUID()}', id, 'credential', id, '${q(hash)}', '${now}', '${now}' FROM "user" u WHERE lower(u.email) = lower('${q(email)}') AND NOT EXISTS (SELECT 1 FROM account a WHERE a."userId" = u.id AND a."providerId" = 'credential');`;
    await Bun.$`bunx wrangler d1 execute DB ${target} --command ${accountSql}`.quiet();
  }
}

async function configuredPlan(): Promise<string> {
  try {
    const text = (await Bun.file("wrangler.jsonc").text()).replace(/^\s*\/\/.*$/gm, "");
    return JSON.parse(text)?.vars?.PLAN ?? "paid";
  } catch {
    return "paid";
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const email = (args.find((a) => !a.startsWith("--")) ?? "").trim().toLowerCase();
  const remote = args.includes("--remote");
  const pwIndex = args.indexOf("--password");
  const password = pwIndex >= 0 ? args[pwIndex + 1] : undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Usage: bun run user:add you@example.com [--password 'secret'] [--remote]");
    process.exit(1);
  }
  const plan = await configuredPlan();
  if (plan === "free" && !password) {
    console.error("This deployment is on the Workers Free plan and signs in with passwords. Add --password 'secret'.");
    process.exit(1);
  }
  if (password && (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX)) {
    console.error(`Password must be ${PASSWORD_MIN} to ${PASSWORD_MAX} characters.`);
    process.exit(1);
  }
  await seedUser(email, remote, password);
  console.log(`${email} can now sign in (${remote ? "remote" : "local"} database).`);
}
