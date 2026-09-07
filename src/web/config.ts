import { createContext, useContext } from "react";
import { DEFAULT_COLOR, HEX_RE } from "../shared/colors";
import type { AppConfig } from "../shared/types";

export const DEFAULT_CONFIG: AppConfig = { name: "my.cdn", color: DEFAULT_COLOR };
const KEY = "app-config";

function sanitize(raw: unknown): AppConfig {
  const c = (raw ?? {}) as Partial<AppConfig>;
  return {
    name: typeof c.name === "string" && c.name.trim() ? c.name.trim().slice(0, 40) : DEFAULT_CONFIG.name,
    color: typeof c.color === "string" && HEX_RE.test(c.color) ? c.color.toLowerCase() : DEFAULT_CONFIG.color,
  };
}

export function cachedConfig(): AppConfig {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY) ?? "null"));
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function fetchConfig(): Promise<AppConfig> {
  const config = sanitize(await fetch("/api/config", { cache: "no-store" }).then((r) => r.json()));
  try {
    localStorage.setItem(KEY, JSON.stringify(config));
  } catch {}
  return config;
}

export const ConfigContext = createContext<AppConfig>(DEFAULT_CONFIG);
export const useConfig = () => useContext(ConfigContext);

export function applyDocument(config: AppConfig, title?: string) {
  document.title = title ? `${title} · ${config.name}` : config.name;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = config.color;
}
