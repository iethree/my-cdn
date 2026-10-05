import type { Stats } from "../shared/types";

const FREE_STORAGE_BYTES = 10 * 1024 ** 3;

export async function collectStats(env: Env): Promise<Stats> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(size), 0) AS bytes FROM image").first<{ n: number; bytes: number }>();
  return {
    storage: { bytes: row?.bytes ?? 0, objects: row?.n ?? 0, limitBytes: FREE_STORAGE_BYTES },
    fetchedAt: new Date().toISOString(),
  };
}
