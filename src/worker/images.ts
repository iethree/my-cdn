import type { ImageDto, UploadEvent } from "../shared/types";
import * as db from "./db";
import { HttpError } from "./http";

export const MAX_BYTES = 25 * 1024 * 1024;
export const MAX_DIM = 2048;

const EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
} as const;
type Format = keyof typeof EXT;

const isFormat = (f: string): f is Format => f in EXT;

export function cleanName(raw: string, ext: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  let stem = base
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.[A-Za-z0-9]{1,5}$/, "")
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^[.\-_]+/, "")
    .slice(0, 100);
  if (!stem) stem = "image";
  return `${stem}.${ext}`;
}

export async function processUpload(
  env: Env,
  file: File,
  tags: string[],
  emit: (e: UploadEvent) => Promise<void>,
): Promise<ImageDto> {
  if (file.size > MAX_BYTES) throw new HttpError(413, "File is larger than 25 MB");

  await emit({ stage: "analyzing" });
  const info = await env.IMAGES.info(file.stream()).catch(() => null);
  if (!info || !("width" in info) || !isFormat(info.format)) {
    throw new HttpError(415, "Unsupported image type (use JPEG, PNG, GIF, WebP or AVIF)");
  }
  const format = info.format;
  const scale = Math.min(1, MAX_DIM / Math.max(info.width, info.height));
  const width = Math.round(info.width * scale);
  const height = Math.round(info.height * scale);

  await emit({ stage: "compressing" });
  const out = await env.IMAGES.input(file.stream())
    .transform({ width: MAX_DIM, height: MAX_DIM, fit: "scale-down" })
    .output({ format, quality: 85, anim: format === "image/gif" });
  const bytes = await new Response(out.image()).arrayBuffer();

  await emit({ stage: "storing" });
  const id = crypto.randomUUID();
  const key = `${id}.${EXT[format]}`;
  const name = await db.uniqueName(env.DB, cleanName(file.name, EXT[format]));
  await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: format } });
  return db.insertImage(
    env.DB,
    {
      id,
      name,
      original_name: file.name.slice(0, 200),
      key,
      content_type: format,
      size: bytes.byteLength,
      width,
      height,
      created_at: Date.now(),
    },
    tags,
  );
}
