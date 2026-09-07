// Usage: bun run user:add you@example.com [--remote]
export async function seedUser(email: string, remote: boolean) {
  const now = new Date().toISOString();
  const q = (s: string) => s.replace(/'/g, "''");
  const sql = `INSERT OR IGNORE INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES ('${crypto.randomUUID()}', '${q(email.split("@")[0]!)}', '${q(email)}', 0, '${now}', '${now}');`;
  await Bun.$`bunx wrangler d1 execute DB ${remote ? "--remote" : "--local"} --command ${sql}`.quiet();
}

if (import.meta.main) {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  const remote = process.argv.includes("--remote");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Usage: bun run user:add you@example.com [--remote]");
    process.exit(1);
  }
  await seedUser(email, remote);
  console.log(`${email} can now sign in (${remote ? "remote" : "local"} database).`);
}
