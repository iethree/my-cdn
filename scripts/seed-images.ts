// Usage: bun run seed:images [--count 1000] [--base http://localhost:8787] [--concurrency 6]
// Generates synthetic PNGs and pushes them through the real upload endpoint of a running `bun run dev`.
import { deflateSync } from "node:zlib";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? (process.argv[i + 1] ?? fallback) : fallback;
};
const COUNT = Number(arg("count", "1000"));
const BASE = arg("base", "http://localhost:8787").replace(/\/$/, "");
const CONCURRENCY = Number(arg("concurrency", "6"));

// --- minimal PNG encoder -------------------------------------------------
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Uint8Array) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Uint8Array) => {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
};
function encodePng(width: number, height: number, rgb: Uint8Array): Uint8Array {
  const raw = new Uint8Array((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) raw.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), y * (width * 3 + 1) + 1);
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", new Uint8Array(deflateSync(raw, { level: 6 }))),
    chunk("IEND", new Uint8Array()),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

// --- synthetic picture ----------------------------------------------------
const rnd = (n: number) => Math.floor(Math.random() * n);
const hsl = (h: number, s: number, l: number): [number, number, number] => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
};
const SIZES = [
  [400, 300], [640, 480], [800, 600], [1024, 768], [1200, 800], [1600, 900], [1920, 1080],
  [300, 400], [600, 800], [900, 1200], [500, 500], [800, 800], [1200, 1200], [2400, 1000],
];
function picture(): { width: number; height: number; png: Uint8Array } {
  const [width, height] = SIZES[rnd(SIZES.length)]!;
  const rgb = new Uint8Array(width * height * 3);
  const hue = rnd(360);
  const a = hsl(hue, 0.7, 0.55);
  const b = hsl((hue + 40 + rnd(80)) % 360, 0.8, 0.4);
  const diag = width + height;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = (x + y) / diag;
      const i = (y * width + x) * 3;
      rgb[i] = a[0] + (b[0] - a[0]) * t;
      rgb[i + 1] = a[1] + (b[1] - a[1]) * t;
      rgb[i + 2] = a[2] + (b[2] - a[2]) * t;
    }
  }
  for (let n = 0; n < 4 + rnd(6); n++) {
    const cx = rnd(width);
    const cy = rnd(height);
    const r = 20 + rnd(Math.min(width, height) / 3);
    const [cr, cg, cb] = hsl((hue + 180 + rnd(60)) % 360, 0.8, 0.5 + Math.random() * 0.3);
    for (let y = Math.max(0, cy - r); y < Math.min(height, cy + r); y++) {
      for (let x = Math.max(0, cx - r); x < Math.min(width, cx + r); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) {
          const i = (y * width + x) * 3;
          rgb[i] = cr;
          rgb[i + 1] = cg;
          rgb[i + 2] = cb;
        }
      }
    }
  }
  return { width, height, png: encodePng(width, height, rgb) };
}

// --- names and tags -------------------------------------------------------
const ADJ = ["sunny", "quiet", "bold", "tiny", "vivid", "misty", "golden", "rusty", "cosmic", "sleepy", "brisk", "velvet", "lucky", "wild", "faded", "neon"];
const NOUN = ["harbor", "meadow", "rocket", "teapot", "canyon", "lantern", "otter", "skyline", "orchard", "comet", "pebble", "willow", "cactus", "anchor", "kite", "fjord"];
const TAGS = ["photo", "screenshot", "wallpaper", "design", "avatar", "banner", "icon", "sketch", "travel", "food", "nature", "city", "abstract", "meme", "diagram", "logo", "product", "portrait", "landscape", "night", "summer", "winter", "blue", "warm", "draft"];
const pickTags = () => {
  const n = rnd(4);
  const out = new Set<string>();
  while (out.size < n) out.add(TAGS[Math.min(TAGS.length - 1, Math.floor(Math.abs(Math.random() - Math.random()) * TAGS.length))]!);
  return [...out];
};

// --- local session ---------------------------------------------------------
async function d1(sql: string): Promise<Record<string, unknown>[]> {
  const r = await Bun.$`bunx wrangler d1 execute DB --local --json --command ${sql}`.quiet();
  const text = r.stdout.toString();
  const parsed = JSON.parse(text.slice(text.indexOf("["))) as { results: Record<string, unknown>[] }[];
  return parsed[0]?.results ?? [];
}

async function sessionCookie(): Promise<string> {
  const vars = await Bun.file(".dev.vars").text();
  const secret = /^BETTER_AUTH_SECRET=(.+)$/m.exec(vars)?.[1]?.trim();
  if (!secret) throw new Error("No BETTER_AUTH_SECRET in .dev.vars");
  const user = (await d1('SELECT id, email FROM "user" ORDER BY "createdAt" LIMIT 1'))[0] as { id: string; email: string } | undefined;
  if (!user) throw new Error("No users in the local database. Run: bun run user:add you@example.com");
  const token = crypto.randomUUID().replace(/-/g, "");
  const now = new Date();
  const exp = new Date(now.getTime() + 86400_000);
  await d1(
    `INSERT INTO "session" (id, "expiresAt", token, "createdAt", "updatedAt", "userId") VALUES ('${crypto.randomUUID()}', '${exp.toISOString()}', '${token}', '${now.toISOString()}', '${now.toISOString()}', '${user.id}')`,
  );
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = Buffer.from(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token))).toString("base64");
  console.log(`Uploading as ${user.email}`);
  return `better-auth.session_token=${encodeURIComponent(`${token}.${sig}`)}`;
}

// --- run --------------------------------------------------------------------
const cookie = await sessionCookie();
const started = Date.now();
let done = 0;
let failed = 0;
let bytesIn = 0;
let bytesOut = 0;

async function uploadOne(i: number) {
  const { png } = picture();
  const name = `${ADJ[rnd(ADJ.length)]}-${NOUN[rnd(NOUN.length)]}-${i + 1}.png`;
  const form = new FormData();
  form.append("file", new File([png], name, { type: "image/png" }));
  form.append("tags", pickTags().join(","));
  const res = await fetch(`${BASE}/api/images`, { method: "POST", body: form, headers: { Cookie: cookie, Origin: BASE } });
  const text = await res.text();
  const last = text.trim().split("\n").pop() ?? "";
  const ev = res.ok ? (JSON.parse(last) as { stage: string; image?: { size: number }; message?: string }) : { stage: "error", message: text };
  if (ev.stage !== "done") throw new Error(ev.message ?? `HTTP ${res.status}`);
  bytesIn += png.length;
  bytesOut += ev.image!.size;
}

let next = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < COUNT) {
      const i = next++;
      try {
        await uploadOne(i);
        done++;
      } catch (e) {
        failed++;
        if (failed <= 5) console.error(`#${i + 1} failed: ${e instanceof Error ? e.message : e}`);
      }
      if ((done + failed) % 50 === 0) console.log(`${done + failed}/${COUNT} (${((Date.now() - started) / 1000).toFixed(0)}s)`);
    }
  }),
);

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
console.log(`\n${done} uploaded, ${failed} failed in ${((Date.now() - started) / 1000).toFixed(0)}s · ${mb(bytesIn)} in → ${mb(bytesOut)} stored`);
