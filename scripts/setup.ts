import { cancel, confirm, intro, isCancel, log, note, outro, password, select, spinner, text } from "@clack/prompts";
import pc from "picocolors";
import { COLOR_PRESETS, DEFAULT_COLOR } from "../src/shared/colors";
import { PASSWORD_MAX, PASSWORD_MIN } from "../src/shared/password";
import { seedUser } from "./seed";

const TEMPLATE = "wrangler.template.jsonc";
const CONFIG = "wrangler.jsonc";
const HOST_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Plan = "free" | "paid";
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

async function apiToken(): Promise<string | null> {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  const home = process.env.HOME ?? "";
  const dirs = [
    process.env.WRANGLER_HOME,
    process.env.XDG_CONFIG_HOME && `${process.env.XDG_CONFIG_HOME}/.wrangler`,
    `${home}/.config/.wrangler`,
    `${home}/Library/Preferences/.wrangler`,
    `${home}/.wrangler`,
  ].filter(Boolean) as string[];
  for (const dir of dirs) {
    const file = Bun.file(`${dir}/config/default.toml`);
    if (await file.exists()) {
      const token = /^oauth_token\s*=\s*"([^"]+)"/m.exec(await file.text())?.[1];
      if (token) return token;
    }
  }
  return null;
}

// Email Sending is Paid-only, so its limits endpoint answers the plan question with scopes wrangler already has.
async function detectPlan(accountId: string | undefined): Promise<Plan | null> {
  const token = await apiToken();
  if (!token || !accountId) return null;
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/limits`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { success?: boolean; result?: { quota?: { value?: number } } };
    if (body.success && (body.result?.quota?.value ?? 0) > 0) return "paid";
    if (res.status === 403 || res.status === 402 || body.success) return "free";
  } catch {}
  return null;
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

const swatch = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `\x1b[48;2;${(n >> 16) & 255};${(n >> 8) & 255};${n & 255}m   \x1b[0m`;
};

// ---------------------------------------------------------------------------

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
const accountId = /\b([0-9a-f]{32})\b/.exec(who.out)?.[1];
login.stop(`Logged in to Cloudflare${cfEmail ? ` as ${pc.bold(cfEmail)}` : ""}`);

const planSpinner = spinner();
planSpinner.start("Checking your Workers plan");
const detected = await detectPlan(accountId);
planSpinner.stop(detected ? `Looks like the Workers ${detected === "paid" ? "Paid" : "Free"} plan` : "Couldn't detect your Workers plan");
const plan = await ask(
  select<Plan>({
    message: detected ? "Is that right?" : "Which Workers plan is this account on?",
    initialValue: detected ?? "free",
    options: [
      { value: "paid", label: "Workers Paid", hint: "sign in with emailed magic links" },
      { value: "free", label: "Workers Free", hint: "sign in with email + password (no email sending on Free)" },
    ],
  }),
);

const appName = await ask(
  text({
    message: "What should your CDN be called?",
    placeholder: "my.cdn",
    defaultValue: "my.cdn",
    validate: (v) => (v && v.trim().length > 40 ? "Keep it under 40 characters" : undefined),
  }),
);
const slug = slugify(appName);

const color = await ask(
  select({
    message: "Pick a primary color (you can change APP_COLOR in wrangler.jsonc later)",
    initialValue: DEFAULT_COLOR as string,
    options: COLOR_PRESETS.map((c) => ({ value: c.hex as string, label: `${swatch(c.hex)} ${c.name}`, hint: c.hex })),
  }),
);

const serve = await ask(
  select<"custom" | "workersdev">({
    message: "Where should it be served?",
    options: [
      { value: "custom", label: "A custom domain", hint: "a zone on this Cloudflare account, or a subdomain of one" },
      { value: "workersdev", label: "A free *.workers.dev address", hint: "no domain needed" },
    ],
  }),
);

const askDomain = (message: string) =>
  ask(
    text({
      message,
      placeholder: "cdn.example.com",
      validate: (v) => (HOST_RE.test((v ?? "").trim()) ? undefined : "Enter a hostname like cdn.example.com"),
    }),
  ).then((v) => v.trim().toLowerCase());

const domain = serve === "custom" ? await askDomain("Which domain? (a zone on this Cloudflare account, or a subdomain of one)") : null;
const emailDomain = plan === "paid" ? (domain ?? (await askDomain("Which domain should sign-in emails come from? (a zone on this account)"))) : null;

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

let userPassword: string | null = null;
if (plan === "free") {
  for (;;) {
    userPassword = await ask(
      password({
        message: `Choose your password (${PASSWORD_MIN} to ${PASSWORD_MAX} characters)`,
        validate: (v) => ((v ?? "").length < PASSWORD_MIN || (v ?? "").length > PASSWORD_MAX ? `${PASSWORD_MIN} to ${PASSWORD_MAX} characters` : undefined),
      }),
    );
    const again = await ask(password({ message: "Type it again" }));
    if (again === userPassword) break;
    log.warn("Those didn't match. Try again.");
  }
}

const deploy = await ask(confirm({ message: "Deploy as soon as setup finishes?", initialValue: true }));

const dbName = `${slug}-db`;
const bucketName = `${slug}-storage`;
const fromAddress = emailDomain ? `login@${emailDomain}` : "";
const siteUrl = domain ? `https://${domain}` : `https://${slug}.<your-subdomain>.workers.dev`;
const row = (k: string, v: string) => `${pc.bold(k.padEnd(13))}${v}`;
note(
  [
    row("Worker", `${slug}  →  ${siteUrl}  ${pc.dim(domain ? "(custom domain; Cloudflare handles DNS + TLS)" : "(exact address printed on deploy)")}`),
    row("Plan", plan === "paid" ? "Workers Paid" : "Workers Free"),
    row("Sign-in", plan === "paid" ? "magic links by email" : `email + password  ${pc.dim("(hashed with PBKDF2; users change theirs in the app)")}`),
    ...(plan === "paid" ? [row("Email", `Email Sending on ${emailDomain}, sending as ${fromAddress}`)] : []),
    row("Color", `${swatch(color)} ${color}`),
    row("D1 database", `${dbName}  ${pc.dim("(tables from migrations/)")}`),
    row("R2 bucket", bucketName),
    row("Secret", `BETTER_AUTH_SECRET  ${pc.dim("(generated locally, never shown)")}`),
    row("First user", `${userEmail}${plan === "free" ? pc.dim("  (with the password you just chose)") : ""}`),
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
  if (domain) {
    cfg.routes = [{ pattern: domain, custom_domain: true }];
  } else {
    delete cfg.routes;
    cfg.workers_dev = true;
  }
  cfg.vars = {
    ...cfg.vars,
    APP_NAME: appName.trim(),
    APP_COLOR: color,
    PLAN: plan,
    EMAIL_FROM: fromAddress,
  };
  await Bun.write(CONFIG, `// Generated by \`bun run setup\` and gitignored. Rerun setup or edit by hand.\n${JSON.stringify(cfg, null, 2)}\n`);
  if (!(await Bun.file(".dev.vars").exists())) {
    await Bun.write(".dev.vars", `BETTER_AUTH_SECRET=${secret()}\nDEV_LOG_MAGIC_LINK=1\n`);
  }
  await wrangler(["types"]);
  return { done: `Wrote ${CONFIG} and .dev.vars` };
});

if (plan === "paid") {
  const emailOk = await step("Enabling Email Sending", async () => {
    const r = await wrangler(["email", "sending", "enable", emailDomain!]);
    const existed = /already (exists|enabled)/i.test(r.out);
    if (r.code !== 0 && !existed) return { value: false, done: pc.yellow(`Email Sending couldn't be enabled for ${emailDomain} automatically`) };
    return { value: true, done: existed ? `Email Sending already enabled on ${emailDomain}` : `Email Sending enabled on ${emailDomain}` };
  });
  if (!emailOk) {
    log.warn(
      `Onboard ${pc.bold(emailDomain!)} by hand: Cloudflare dashboard → Compute & AI → Email Service → Email Sending → Onboard Domain.\nSign-in emails won't send until that's done. Everything else keeps working.`,
    );
  }
}

await step("Applying database migrations", async () => {
  const r = await wrangler(["d1", "migrations", "apply", "DB", "--remote"]);
  if (r.code !== 0) throw new Error(`Migrations failed.\n${r.out}`);
  await wrangler(["d1", "migrations", "apply", "DB", "--local"]);
  return { done: "Database migrated (remote and local)" };
});

await step("Adding your first user", async () => {
  await seedUser(userEmail, true, userPassword ?? undefined);
  await seedUser(userEmail, false, userPassword ?? undefined);
  return { done: `${userEmail} can sign in` };
});

let deployedUrl: string | null = null;
if (deploy) {
  log.step("Deploying");
  const built = await Bun.$`bun scripts/build.ts`.nothrow().quiet();
  const r = built.exitCode === 0 ? await wrangler(["deploy"]) : { code: built.exitCode, out: built.stderr.toString() };
  console.log(pc.dim(r.out.trim()));
  if (r.code !== 0) {
    log.error(
      `Deploy didn't finish. Fix the error above and run ${pc.bold("bun run deploy")}.\nIf it mentions an existing DNS record on ${domain}, run ${pc.bold("bunx wrangler deploy --force")} to replace it.`,
    );
  } else {
    deployedUrl = /https:\/\/\S+\.workers\.dev/.exec(r.out)?.[0] ?? (domain ? `https://${domain}` : null);
  }
}

await step("Storing BETTER_AUTH_SECRET", async () => {
  const r = await wrangler(["secret", "put", "BETTER_AUTH_SECRET"], { input: `${secret()}\n` });
  if (r.code !== 0) throw new Error(`Couldn't store the secret. Run: bunx wrangler secret put BETTER_AUTH_SECRET\n${r.out}`);
  return { done: "Secret stored on the worker" };
});

const finalUrl = deployedUrl ?? (domain ? `https://${domain}` : "the workers.dev address wrangler prints on deploy");
outro(
  [
    pc.green(pc.bold("All set!")),
    deploy ? `Visit ${pc.bold(finalUrl)} and sign in as ${userEmail}.` : `Run ${pc.bold("bun run deploy")} when you're ready, then sign in as ${userEmail} at ${finalUrl}.`,
    plan === "free"
      ? `Add more users at /u in the app, or with ${pc.bold("bun run user:add them@example.com --password '…' --remote")}.`
      : `Add more users at /u in the app.`,
    `Local dev: ${pc.bold("bun run dev")}${plan === "paid" ? " (sign-in links print to the console)" : ""}.`,
  ].join("\n   "),
);
