export const DEFAULT_COLOR = "#9d03fc";
export const HEX_RE = /^#[0-9a-f]{6}$/i;

export const COLOR_PRESETS = [
  { name: "Cherry", hex: "#e0243f" },
  { name: "Tangerine", hex: "#f0700a" },
  { name: "Amber", hex: "#e8a500" },
  { name: "Leaf", hex: "#22a55b" },
  { name: "Teal", hex: "#0aa3a3" },
  { name: "Sky", hex: "#1f6fee" },
  { name: "Violet", hex: DEFAULT_COLOR },
  { name: "Bubblegum", hex: "#e6338f" },
] as const;

export function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r ? ((g - b) / d + (g < b ? 6 : 0)) * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
  return [h, s * 100, l * 100];
}

export function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lig = l / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lig - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}

// Ten Mantine shades with the configured color at index 6.
export function shadesFor(hex: string): string[] {
  const base = HEX_RE.test(hex) ? hex.toLowerCase() : DEFAULT_COLOR;
  const [h, s, l] = hexToHsl(base);
  return Array.from({ length: 10 }, (_, i) => {
    if (i === 6) return base;
    if (i < 6) return hslToHex(h, s, l + (96 - l) * ((6 - i) / 6) ** 0.75);
    return hslToHex(h, s, l - (l - 20) * ((i - 6) / 3) * 0.8);
  });
}
