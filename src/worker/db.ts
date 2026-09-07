import type { ImageDto, TagDto, UserDto } from "../shared/types";

export type ImageRow = {
  id: string;
  name: string;
  original_name: string;
  key: string;
  content_type: string;
  size: number;
  width: number;
  height: number;
  created_at: number;
};

const COLS = "id, name, original_name, key, content_type, size, width, height, created_at";
const SELECT = `SELECT ${COLS} FROM image`;
const CHUNK = 90;

function toDto(row: ImageRow, tags: string[], aliases: string[]): ImageDto {
  return {
    id: row.id,
    name: row.name,
    originalName: row.original_name,
    contentType: row.content_type,
    size: row.size,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
    tags,
    aliases,
  };
}

export async function hydrate(db: D1Database, rows: ImageRow[]): Promise<ImageDto[]> {
  const tags = new Map<string, string[]>();
  const aliases = new Map<string, string[]>();
  for (let i = 0; i < rows.length; i += CHUNK) {
    const ids = rows.slice(i, i + CHUNK).map((r) => r.id);
    const ph = ids.map(() => "?").join(",");
    const [t, a] = await db.batch<{ id: string; name: string }>([
      db
        .prepare(
          `SELECT it.image_id AS id, t.name FROM image_tag it JOIN tag t ON t.id = it.tag_id WHERE it.image_id IN (${ph}) ORDER BY t.name`,
        )
        .bind(...ids),
      db.prepare(`SELECT image_id AS id, name FROM image_alias WHERE image_id IN (${ph}) ORDER BY name`).bind(...ids),
    ]);
    for (const r of t!.results) tags.set(r.id, [...(tags.get(r.id) ?? []), r.name]);
    for (const r of a!.results) aliases.set(r.id, [...(aliases.get(r.id) ?? []), r.name]);
  }
  return rows.map((r) => toDto(r, tags.get(r.id) ?? [], aliases.get(r.id) ?? []));
}

export function findRowByName(db: D1Database, name: string) {
  return db
    .prepare(`${SELECT} WHERE name = ?1 OR id IN (SELECT image_id FROM image_alias WHERE name = ?1) LIMIT 1`)
    .bind(name)
    .first<ImageRow>();
}

export function findRowById(db: D1Database, id: string) {
  return db.prepare(`${SELECT} WHERE id = ?`).bind(id).first<ImageRow>();
}

export async function getImage(db: D1Database, id: string): Promise<ImageDto | null> {
  const row = await findRowById(db, id);
  return row ? (await hydrate(db, [row]))[0]! : null;
}

export async function listRecent(db: D1Database, limit: number) {
  const { results } = await db.prepare(`${SELECT} ORDER BY created_at DESC LIMIT ?`).bind(limit).all<ImageRow>();
  return hydrate(db, results);
}

export async function search(db: D1Database, q: string, limit: number) {
  const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  const { results } = await db
    .prepare(
      `${SELECT} WHERE name LIKE ?1 ESCAPE '\\'
         OR original_name LIKE ?1 ESCAPE '\\'
         OR id IN (SELECT image_id FROM image_alias WHERE name LIKE ?1 ESCAPE '\\')
         OR id IN (SELECT it.image_id FROM image_tag it JOIN tag t ON t.id = it.tag_id WHERE t.name LIKE ?1 ESCAPE '\\')
       ORDER BY created_at DESC LIMIT ?2`,
    )
    .bind(like, limit)
    .all<ImageRow>();
  return hydrate(db, results);
}

export async function listTags(db: D1Database): Promise<TagDto[]> {
  const { results } = await db
    .prepare(
      "SELECT t.name, COUNT(it.image_id) AS count FROM tag t JOIN image_tag it ON it.tag_id = t.id GROUP BY t.id ORDER BY count DESC, t.name",
    )
    .all<TagDto>();
  return results;
}

export async function imagesForTag(db: D1Database, tag: string, limit: number) {
  const { results } = await db
    .prepare(
      `${SELECT} WHERE id IN (SELECT it.image_id FROM image_tag it JOIN tag t ON t.id = it.tag_id WHERE t.name = ?1) ORDER BY created_at DESC LIMIT ?2`,
    )
    .bind(tag, limit)
    .all<ImageRow>();
  return hydrate(db, results);
}

export async function nameTaken(db: D1Database, name: string, exceptImageId = ""): Promise<boolean> {
  const row = await db
    .prepare(
      "SELECT 1 AS x FROM image WHERE name = ?1 AND id != ?2 UNION SELECT 1 FROM image_alias WHERE name = ?1 AND image_id != ?2",
    )
    .bind(name, exceptImageId)
    .first();
  return row !== null;
}

export async function uniqueName(db: D1Database, wanted: string): Promise<string> {
  if (!(await nameTaken(db, wanted))) return wanted;
  const dot = wanted.lastIndexOf(".");
  const [stem, ext] = dot > 0 ? [wanted.slice(0, dot), wanted.slice(dot)] : [wanted, ""];
  for (let i = 2; i < 50; i++) {
    const candidate = `${stem}-${i}${ext}`;
    if (!(await nameTaken(db, candidate))) return candidate;
  }
  return `${stem}-${crypto.randomUUID().slice(0, 8)}${ext}`;
}

function tagStatements(db: D1Database, imageId: string, tags: string[]) {
  const stmts = [db.prepare("DELETE FROM image_tag WHERE image_id = ?").bind(imageId)];
  for (const t of tags) {
    stmts.push(
      db.prepare("INSERT OR IGNORE INTO tag (name) VALUES (?)").bind(t),
      db.prepare("INSERT OR IGNORE INTO image_tag (image_id, tag_id) SELECT ?, id FROM tag WHERE name = ?").bind(imageId, t),
    );
  }
  stmts.push(db.prepare("DELETE FROM tag WHERE id NOT IN (SELECT tag_id FROM image_tag)"));
  return stmts;
}

export async function insertImage(db: D1Database, row: ImageRow, tags: string[]): Promise<ImageDto> {
  await db.batch([
    db
      .prepare(`INSERT INTO image (${COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(row.id, row.name, row.original_name, row.key, row.content_type, row.size, row.width, row.height, row.created_at),
    ...tagStatements(db, row.id, tags),
  ]);
  return toDto(row, [...tags].sort(), []);
}

export async function setTags(db: D1Database, imageId: string, tags: string[]) {
  await db.batch(tagStatements(db, imageId, tags));
}

export async function rename(db: D1Database, imageId: string, name: string) {
  await db.prepare("UPDATE image SET name = ? WHERE id = ?").bind(name, imageId).run();
}

export async function addAlias(db: D1Database, imageId: string, name: string) {
  await db.prepare("INSERT INTO image_alias (name, image_id) VALUES (?, ?)").bind(name, imageId).run();
}

export async function removeAlias(db: D1Database, imageId: string, name: string) {
  await db.prepare("DELETE FROM image_alias WHERE name = ? AND image_id = ?").bind(name, imageId).run();
}

export async function deleteImage(db: D1Database, imageId: string) {
  await db.batch([
    db.prepare("DELETE FROM image WHERE id = ?").bind(imageId),
    db.prepare("DELETE FROM tag WHERE id NOT IN (SELECT tag_id FROM image_tag)"),
  ]);
}

export async function userExists(db: D1Database, email: string): Promise<boolean> {
  const row = await db.prepare('SELECT 1 AS x FROM "user" WHERE lower(email) = lower(?)').bind(email.trim()).first();
  return row !== null;
}

export async function listUsers(db: D1Database): Promise<UserDto[]> {
  const { results } = await db
    .prepare('SELECT id, email, name, "createdAt" AS createdAt FROM "user" ORDER BY "createdAt"')
    .all<UserDto>();
  return results;
}

export async function countUsers(db: D1Database): Promise<number> {
  const row = await db.prepare('SELECT COUNT(*) AS n FROM "user"').first<{ n: number }>();
  return row?.n ?? 0;
}

export function userInsert(db: D1Database, email: string) {
  const now = new Date().toISOString();
  return db
    .prepare(
      'INSERT OR IGNORE INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES (?, ?, ?, 0, ?, ?)',
    )
    .bind(crypto.randomUUID(), email.split("@")[0], email, now, now);
}

export async function deleteUser(db: D1Database, id: string) {
  await db.prepare('DELETE FROM "user" WHERE id = ?').bind(id).run();
}
