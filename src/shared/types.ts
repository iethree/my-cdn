export type ImageDto = {
  id: string;
  name: string;
  originalName: string;
  contentType: string;
  size: number;
  width: number;
  height: number;
  createdAt: number;
  tags: string[];
  aliases: string[];
};

export type TagDto = { name: string; count: number };

export type UploadEvent =
  | { stage: "analyzing" | "compressing" | "storing" }
  | { stage: "done"; image: ImageDto }
  | { stage: "error"; message: string };

export const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;
export const TAG_RE = /^[a-z0-9][a-z0-9._-]{0,39}$/;
export const THUMB_WIDTHS = [256, 512, 1024] as const;

export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9._-]/g, "").slice(0, 40);
}

export function imageUrl(origin: string, name: string, width?: number): string {
  return `${origin}/i/${encodeURIComponent(name)}${width ? `?w=${width}` : ""}`;
}

export type UserDto = { id: string; email: string; name: string; createdAt: string };

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
