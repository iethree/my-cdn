import { DEFAULT_COLOR, HEX_RE } from "../shared/colors";
import { EMAIL_RE, NAME_RE, PAGE_SIZE, THUMB_WIDTHS, normalizeTag, TAG_RE, type AppConfig, type UploadEvent } from "../shared/types";
import { createAuth } from "./auth";
import * as db from "./db";
import { HttpError, json } from "./http";
import { MAX_BYTES, processUpload } from "./images";

const IMMUTABLE = "public, max-age=86400";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/i/")) return await serveImage(request, env, ctx, url);
      if (url.pathname.startsWith("/api/auth/")) return await createAuth(env, url.origin).handler(request);
      if (url.pathname.startsWith("/api/")) return await handleApi(request, env, ctx, url);
      return env.ASSETS.fetch(request);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: "Internal error" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;

function cacheKey(origin: string, name: string, width?: number) {
  return new Request(`${origin}/i/${encodeURIComponent(name)}${width ? `?w=${width}` : ""}`);
}

async function purge(origin: string, names: string[]) {
  const cache = caches.default;
  await Promise.all(
    names.flatMap((n) => [undefined, ...THUMB_WIDTHS].map((w) => cache.delete(cacheKey(origin, n, w)))),
  );
}

async function serveImage(request: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405 });
  const name = decodeURIComponent(url.pathname.slice(3));
  if (!NAME_RE.test(name)) return new Response("Not found", { status: 404 });
  const w = Number(url.searchParams.get("w"));
  const width = (THUMB_WIDTHS as readonly number[]).includes(w) ? w : undefined;

  const cache = caches.default;
  const key = cacheKey(url.origin, name, width);
  let res = await cache.match(key);
  if (!res) {
    const img = await db.findRowByName(env.DB, name);
    const obj = img && (await env.BUCKET.get(img.key));
    if (!img || !obj) return new Response("Not found", { status: 404 });
    const headers = new Headers({
      "Content-Type": img.content_type,
      "Cache-Control": IMMUTABLE,
      ETag: width ? `"${obj.etag}-${width}"` : obj.httpEtag,
      "Content-Disposition": `inline; filename="${img.original_name.replace(/["\\]/g, "")}"`,
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
    });
    if (width && Math.max(img.width, img.height) > width) {
      const out = await env.IMAGES.input(obj.body)
        .transform({ width, height: width, fit: "scale-down" })
        .output({ format: img.content_type as "image/jpeg", quality: 80, anim: img.content_type === "image/gif" });
      res = new Response(out.image(), { headers });
    } else {
      res = new Response(obj.body, { headers });
    }
    ctx.waitUntil(cache.put(key, res.clone()));
  }

  if (request.headers.get("If-None-Match") === res.headers.get("ETag")) {
    return new Response(null, { status: 304, headers: res.headers });
  }
  if (url.searchParams.has("download")) {
    res = new Response(res.body, res);
    res.headers.set("Content-Disposition", res.headers.get("Content-Disposition")!.replace("inline", "attachment"));
  }
  return request.method === "HEAD" ? new Response(null, res) : res;
}

function ndjson(ctx: ExecutionContext, run: (emit: (e: UploadEvent) => Promise<void>) => Promise<UploadEvent>) {
  const { readable, writable } = new TransformStream<Uint8Array>();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  const emit = (e: UploadEvent) => writer.write(enc.encode(`${JSON.stringify(e)}\n`));
  ctx.waitUntil(
    (async () => {
      try {
        await emit(await run(emit));
      } catch (e) {
        await emit({ stage: "error", message: e instanceof HttpError ? e.message : "Processing failed" });
        if (!(e instanceof HttpError)) console.error(e);
      } finally {
        await writer.close();
      }
    })(),
  );
  return new Response(readable, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

function pageLimit(url: URL): number {
  const n = Number(url.searchParams.get("limit"));
  return Number.isInteger(n) && n > 0 ? Math.min(n, PAGE_SIZE) : PAGE_SIZE;
}

function parseTags(input: unknown): string[] {
  const raw = Array.isArray(input) ? input : typeof input === "string" ? input.split(",") : [];
  const tags = new Set<string>();
  for (const t of raw) {
    if (typeof t !== "string") continue;
    const n = normalizeTag(t);
    if (n && TAG_RE.test(n)) tags.add(n);
  }
  if (tags.size > 50) throw new HttpError(400, "Too many tags");
  return [...tags];
}

function requireName(value: unknown): string {
  if (typeof value !== "string" || !NAME_RE.test(value)) {
    throw new HttpError(400, "Names may only contain letters, numbers, dots, dashes and underscores");
  }
  return value;
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") throw new HttpError(400, "Invalid JSON body");
  return body as Record<string, unknown>;
}

async function handleApi(request: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  const parts = url.pathname.slice(5).split("/").filter(Boolean).map(decodeURIComponent);
  const method = request.method;

  if (method === "GET" && parts[0] === "config" && parts.length === 1) {
    const color = HEX_RE.test(env.APP_COLOR ?? "") ? env.APP_COLOR.toLowerCase() : DEFAULT_COLOR;
    return Response.json({ name: env.APP_NAME, color } satisfies AppConfig, { headers: { "Cache-Control": "no-cache" } });
  }

  if (method === "GET" && parts[0] === "tags") {
    if (parts.length === 1) return json(await db.listTags(env.DB));
    if (parts.length === 2) {
      const tag = normalizeTag(parts[1]!);
      return json({ tag, ...(await db.listPage(env.DB, { tag }, url.searchParams.get("cursor"), pageLimit(url))) });
    }
  }

  if (method !== "GET" && request.headers.get("Origin") !== url.origin) throw new HttpError(403, "Bad origin");
  const session = await createAuth(env, url.origin).api.getSession({ headers: request.headers });
  if (!session) throw new HttpError(401, "Sign in required");

  if (parts[0] === "users") {
    if (method === "GET" && parts.length === 1) return json(await db.listUsers(env.DB));
    if (method === "POST" && parts.length === 1) {
      const email = String((await readBody(request)).email ?? "").trim().toLowerCase();
      if (!EMAIL_RE.test(email) || email.length > 254) throw new HttpError(400, "Enter a valid email address");
      await db.userInsert(env.DB, email).run();
      return json(await db.listUsers(env.DB));
    }
    if (method === "DELETE" && parts.length === 2) {
      if (parts[1] === session.user.id) throw new HttpError(400, "You can't remove yourself");
      if ((await db.countUsers(env.DB)) <= 1) throw new HttpError(400, "Can't remove the last user");
      await db.deleteUser(env.DB, parts[1]!);
      return json(await db.listUsers(env.DB));
    }
    throw new HttpError(404, "Not found");
  }

  if (parts[0] !== "images") throw new HttpError(404, "Not found");
  const [, id, sub, subId] = parts;

  if (!id) {
    if (method === "GET") {
      const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
      return json(await db.listPage(env.DB, { q }, url.searchParams.get("cursor"), pageLimit(url)));
    }
    if (method === "POST") {
      if (Number(request.headers.get("Content-Length")) > MAX_BYTES + 4096) throw new HttpError(413, "File is larger than 25 MB");
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new HttpError(400, "Missing file");
      const tags = parseTags(form.get("tags"));
      return ndjson(ctx, async (emit) => ({ stage: "done", image: await processUpload(env, file, tags, emit) }));
    }
  }

  if (id && !sub) {
    const image = await db.getImage(env.DB, id);
    if (!image) throw new HttpError(404, "Image not found");
    if (method === "GET") return json(image);
    if (method === "PATCH") {
      const body = await readBody(request);
      if (body.name !== undefined && body.name !== image.name) {
        const name = requireName(body.name);
        if (await db.nameTaken(env.DB, name, id)) throw new HttpError(409, "That name is already in use");
        if (image.aliases.includes(name)) await db.removeAlias(env.DB, id, name);
        await db.rename(env.DB, id, name);
        ctx.waitUntil(purge(url.origin, [image.name]));
      }
      if (body.tags !== undefined) await db.setTags(env.DB, id, parseTags(body.tags));
      return json(await db.getImage(env.DB, id));
    }
    if (method === "DELETE") {
      const row = (await db.findRowById(env.DB, id))!;
      await db.deleteImage(env.DB, id);
      ctx.waitUntil(Promise.all([env.BUCKET.delete(row.key), purge(url.origin, [image.name, ...image.aliases])]));
      return json({ ok: true });
    }
  }

  if (id && sub === "aliases") {
    const image = await db.getImage(env.DB, id);
    if (!image) throw new HttpError(404, "Image not found");
    if (method === "POST" && !subId) {
      const name = requireName((await readBody(request)).name);
      if (name === image.name || (await db.nameTaken(env.DB, name))) throw new HttpError(409, "That name is already in use");
      await db.addAlias(env.DB, id, name);
      return json(await db.getImage(env.DB, id));
    }
    if (method === "DELETE" && subId) {
      await db.removeAlias(env.DB, id, subId);
      ctx.waitUntil(purge(url.origin, [subId]));
      return json(await db.getImage(env.DB, id));
    }
  }

  throw new HttpError(404, "Not found");
}
