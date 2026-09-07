import { cancel, confirm, intro, isCancel, log, note, outro, select, spinner, text } from "@clack/prompts";
import pc from "picocolors";
import { COLOR_PRESETS, DEFAULT_COLOR } from "../src/shared/colors";
import { seedUser } from "./seed";

const TEMPLATE = "wrangler.template.jsonc";
const CONFIG = "wrangler.jsonc";
const HOST_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Result = { code: number; stdout: string; stderr: string; out: string };

async function wrangler(args: string[], opts: { input?: string; inherit?: boolean } = {}): Promise<Result> {
  const proc = Bun.spawn(["bunx", "wrangler", ...args], {
    stdin: opts.input !== undefined ? new Response(opts.input) : opts.inherit ? "inherit" : "ignore",
    stdout: opts.inherit ? "inherit" : "pipe",
    stderr: opts.inherit ? "inherit" : "pipe",
    env: { ...process.env, NO_COLOR: "1", WRANGLER_SEND_METRICS: "false" },
  });
  const [stdout, stderr] = await Promise.all([
    proc.stdout ? new Response(proc.stdout).text() : Promise.resolve(""),
    proc.stderr ? new Response(proc.stderr).text() : Promise.resolve(""),
  ]);
  const code = await proc.exited;
  return { code, stdout, stderr, out: `${stdout}\n${stderr}` };
}

function bail(message: string, detail?: string): never {
  cancel(message);
  if (detail) console.error(pc.dim(detail.trim()));
  process.exit(1);
}

async function ask<T>(promise: Promise<T | symbol>): Promise<T> {
  const value = await promise;
  if (isCancel(value)) {
    cancel("Setup cancelled. Nothing was created.");
    process.exit(0);
  }
  return value as T;
}

async function step<T>(label: string, fn: () => Promise<{ value?: T; done: string }>): Promise<T | undefined> {
  const s = spinner();
  s.start(label);
  try {
    const { value, done } = await fn();
    s.stop(done);
    return value;
  } catch (e) {
    s.error(label);
    bail(e instanceof Error ? e.message : String(e));
  }
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54) || "my-cdn";

const secret = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64");

intro(pc.bgMagenta(pc.black(pc.bold(" my.cdn setup "))));

if (await Bun.file(CONFIG).exists()) {
  const overwrite = await ask(confirm({ message: `${CONFIG} already exists. Overwrite it with a fresh setup?`, initialValue: false }));
  if (!overwrite) {
    cancel("Keeping the existing config. Nothing was changed.");
    process.exit(0);
  }
}

const login = spinner();
login.start("Checking Cloudflare login");
let who = await wrangler(["whoami"]);
if (!/logged in/i.test(who.out)) {
  login.stop("Not logged in to Cloudflare yet");
  log.info("Opening the Cloudflare login flow in your browser…");
  await wrangler(["login"], { inherit: true });
  who = await wrangler(["whoami"]);
  if (!/logged in/i.test(who.out)) bail("Cloudflare login didn't complete.", who.out);
  login.start("Checking Cloudflare login");
}
const cfEmail = /associated with the email (\S+?)\.?\s*$/m.exec(who.out)?.[1];
login.stop(`Logged in to Cloudflare${cfEmail ? ` as ${pc.bold(cfEmail)}` : ""}`);

const appName = await ask(
  text({
    message: "What should your CDN be called?",
    placeholder: "my.cdn",
    defaultValue: "my.cdn",
    validate: (v) => (v && v.trim().length > 40 ? "Keep it under 40 characters" : undefined),
  }),
);
const slug = slugify(appName);

const swatch = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `\x1b[48;2;${(n >> 16) & 255};${(n >> 8) & 255};${n & 255}m   \x1b[0m`;
};
const color = await ask(
  select({
    message: "Pick a primary color (you can change APP_COLOR in wrangler.jsonc later)",
    initialValue: DEFAULT_COLOR as string,
    options: COLOR_PRESETS.map((c) => ({ value: c.hex as string, label: `${swatch(c.hex)} ${c.name}`, hint: c.hex })),
  }),
);

const domain = (
  await ask(
    text({
      message: "Which domain should serve it? (a zone on this Cloudflare account, or a subdomain of one)",
      placeholder: "cdn.example.com",
      validate: (v) => (HOST_RE.test((v ?? "").trim()) ? undefined : "Enter a hostname like cdn.example.com"),
    }),
  )
)
  .trim()
  .toLowerCase();

const userEmail = (
  await ask(
    text({
      message: "Your email? (the first user who can sign in)",
      placeholder: "you@example.com",
      validate: (v) => (EMAIL_RE.test((v ?? "").trim()) ? undefined : "Enter a valid email address"),
    }),
  )
)
  .trim()
  .toLowerCase();

const deploy = await ask(confirm({ message: "Deploy as soon as setup finishes?", initialValue: true }));

const dbName = `${slug}-db`;
const bucketName = `${slug}-storage`;
const fromAddress = `login@${domain}`;
const row = (k: string, v: string) => `${pc.bold(k.padEnd(13))}${v}`;
note(
  [
    row("Worker", `${slug}  →  https://${domain}  ${pc.dim("(custom domain; Cloudflare handles DNS + TLS)")}`),
    row("Color", `${swatch(color)} ${color}`),
    row("D1 database", `${dbName}  ${pc.dim("(tables from migrations/)")}`),
    row("R2 bucket", bucketName),
    row("Email", `Email Sending on ${domain}, sending as ${fromAddress}`),
    row("Secret", `BETTER_AUTH_SECRET  ${pc.dim("(generated locally, never shown)")}`),
    row("First user", userEmail),
    row("Local files", `${CONFIG} and .dev.vars  ${pc.dim("(both gitignored)")}`),
    row("Deploy", deploy ? "right after setup" : pc.dim("later, with `bun run deploy`")),
  ].join("\n"),
  "Here's what setup will create on your Cloudflare account",
);

if (!(await ask(confirm({ message: "Go ahead?" })))) {
  cancel("Nothing was created.");
  process.exit(0);
}

const databaseId = await step("Creating D1 database", async () => {
  const r = await wrangler(["d1", "create", dbName]);
  const existed = r.code !== 0 && /already exists/i.test(r.out);
  if (r.code !== 0 && !existed) throw new Error(`Couldn't create the D1 database.\n${r.out}`);
  const info = await wrangler(["d1", "info", dbName, "--json"]);
  const id = (JSON.parse(info.stdout) as { uuid?: string }).uuid;
  if (!id) throw new Error(`Couldn't read the D1 database id.\n${info.out}`);
  return { value: id, done: existed ? `D1 database ${dbName} already existed, reusing it` : `D1 database ${dbName} created` };
});

await step("Creating R2 bucket", async () => {
  const r = await wrangler(["r2", "bucket", "create", bucketName]);
  const existed = r.code !== 0 && /already exists/i.test(r.out);
  if (r.code !== 0 && !existed) throw new Error(`Couldn't create the R2 bucket.\n${r.out}`);
  return { done: existed ? `R2 bucket ${bucketName} already existed, reusing it` : `R2 bucket ${bucketName} created` };
});

await step("Writing config", async () => {
  const cfg = JSON.parse(await Bun.file(TEMPLATE).text());
  cfg.name = slug;
  cfg.d1_databases[0].database_name = dbName;
  cfg.d1_databases[0].database_id = databaseId;
  cfg.r2_buckets[0].bucket_name = bucketName;
  cfg.routes = [{ pattern: domain, custom_domain: true }];
  cfg.vars = { ...cfg.vars, APP_NAME: appName.trim(), APP_COLOR: color, EMAIL_FROM: fromAddress };
  await Bun.write(CONFIG, `// Generated by \`bun run setup\` and gitignored. Rerun setup or edit by hand.\n${JSON.stringify(cfg, null, 2)}\n`);
  if (!(await Bun.file(".dev.vars").exists())) {
    await Bun.write(".dev.vars", `BETTER_AUTH_SECRET=${secret()}\nDEV_LOG_MAGIC_LINK=1\n`);
  }
  await wrangler(["types"]);
  return { done: `Wrote ${CONFIG} and .dev.vars` };
});

const emailOk = await step("Enabling Email Sending", async () => {
  const r = await wrangler(["email", "sending", "enable", domain]);
  const existed = /already (exists|enabled)/i.test(r.out);
  if (r.code !== 0 && !existed) return { value: false, done: pc.yellow(`Email Sending couldn't be enabled for ${domain} automatically`) };
  return { value: true, done: existed ? `Email Sending already enabled on ${domain}` : `Email Sending enabled on ${domain}` };
});
if (!emailOk) {
  log.warn(
    `Onboard ${pc.bold(domain)} by hand: Cloudflare dashboard → Compute & AI → Email Service → Email Sending → Onboard Domain.\nSign-in emails won't send until that's done. Everything else keeps working.`,
  );
}

await step("Applying database migrations", async () => {
  const r = await wrangler(["d1", "migrations", "apply", "DB", "--remote"]);
  if (r.code !== 0) throw new Error(`Migrations failed.\n${r.out}`);
  await wrangler(["d1", "migrations", "apply", "DB", "--local"]);
  return { done: "Database migrated (remote and local)" };
});

await step("Adding your first user", async () => {
  await seedUser(userEmail, true);
  await seedUser(userEmail, false);
  return { done: `${userEmail} can sign in` };
});

if (deploy) {
  log.step("Deploying");
  const built = await Bun.$`bun scripts/build.ts`.nothrow().quiet();
  const r = built.exitCode === 0 ? await wrangler(["deploy"], { inherit: true }) : { code: built.exitCode };
  if (r.code !== 0) {
    log.error(
      `Deploy didn't finish. Fix the error above and run ${pc.bold("bun run deploy")}.\nIf it mentions an existing DNS record on ${domain}, run ${pc.bold("bunx wrangler deploy --force")} to replace it.`,
    );
  }
}

await step("Storing BETTER_AUTH_SECRET", async () => {
  const r = await wrangler(["secret", "put", "BETTER_AUTH_SECRET"], { input: `${secret()}\n` });
  if (r.code !== 0) throw new Error(`Couldn't store the secret. Run: bunx wrangler secret put BETTER_AUTH_SECRET\n${r.out}`);
  return { done: "Secret stored on the worker" };
});

outro(
  [
    pc.green(pc.bold("All set!")),
    deploy ? `Visit ${pc.bold(`https://${domain}`)} and sign in as ${userEmail}.` : `Run ${pc.bold("bun run deploy")} when you're ready, then sign in as ${userEmail}.`,
    `Local dev: ${pc.bold("bun run dev")} (sign-in links print to the console).`,
  ].join("\n   "),
);
