import type { ImageDto, ImagePage, Stats, TagDto, UploadEvent, UserDto } from "../shared/types";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

const params = (o: Record<string, string | number | null | undefined>) =>
  new URLSearchParams(Object.entries(o).filter(([, v]) => v != null && v !== "").map(([k, v]) => [k, String(v)])).toString();

export const api = {
  images: (q: string, cursor: string | null = null, limit?: number) =>
    request<ImagePage>("GET", `/api/images?${params({ q, cursor, limit })}`),
  image: (id: string) => request<ImageDto>("GET", `/api/images/${id}`),
  update: (id: string, patch: { name?: string; tags?: string[] }) => request<ImageDto>("PATCH", `/api/images/${id}`, patch),
  remove: (id: string) => request<{ ok: true }>("DELETE", `/api/images/${id}`),
  addAlias: (id: string, name: string) => request<ImageDto>("POST", `/api/images/${id}/aliases`, { name }),
  removeAlias: (id: string, name: string) =>
    request<ImageDto>("DELETE", `/api/images/${id}/aliases/${encodeURIComponent(name)}`),
  tags: () => request<TagDto[]>("GET", "/api/tags"),
  tag: (name: string, cursor: string | null = null) =>
    request<{ tag: string } & ImagePage>("GET", `/api/tags/${encodeURIComponent(name)}?${params({ cursor })}`),
  users: () => request<UserDto[]>("GET", "/api/users"),
  addUser: (email: string, password?: string) => request<UserDto[]>("POST", "/api/users", { email, password }),
  removeUser: (id: string) => request<UserDto[]>("DELETE", `/api/users/${id}`),
  stats: () => request<Stats>("GET", "/api/stats"),
};

export type ClientUploadEvent = { stage: "uploading"; loaded: number; total: number } | UploadEvent;

export function uploadImage(file: File, tags: string[], onEvent: (e: ClientUploadEvent) => void): Promise<ImageDto> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file);
    form.append("tags", tags.join(","));

    let seen = 0;
    let done: ImageDto | undefined;
    let failure: string | undefined;
    const drain = () => {
      const text = xhr.responseText;
      const end = text.lastIndexOf("\n");
      if (end < seen) return;
      const lines = text.slice(seen, end).split("\n");
      seen = end + 1;
      for (const line of lines) {
        if (!line) continue;
        const ev = JSON.parse(line) as UploadEvent;
        if (ev.stage === "done") done = ev.image;
        else if (ev.stage === "error") failure = ev.message;
        else onEvent(ev);
      }
    };

    xhr.open("POST", "/api/images");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onEvent({ stage: "uploading", loaded: e.loaded, total: e.total });
    };
    xhr.onprogress = drain;
    xhr.onload = () => {
      if (xhr.status >= 400) {
        let message = `Upload failed (${xhr.status})`;
        try {
          message = (JSON.parse(xhr.responseText) as { error?: string }).error ?? message;
        } catch {}
        return reject(new Error(message));
      }
      drain();
      done ? resolve(done) : reject(new Error(failure ?? "Upload failed"));
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(form);
  });
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
