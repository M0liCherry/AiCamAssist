export type Theme = "dark" | "light";

const THEME_KEY = "verity_theme";
const SEED_KEY = "verity_seed";

export const DEFAULT_SEED = "#6750A4";

/** Preset seeds shown in Theme studio (matches the reference layout). */
export const SEED_PRESETS = [
  "#6750A4", // violet (default)
  "#2F7D33", // green
  "#0B6E5F", // teal
  "#0B57D0", // blue
  "#BA1A1A", // red
  "#8A5A00", // amber / brown
  "#A3347F", // magenta
  "#45556C", // slate
];

export function normalizeSeed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const hex = value.trim().toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(hex)) return hex;
  return null;
}

type RGB = { r: number; g: number; b: number };

function hexToRgb(hex: string): RGB {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function toHex({ r, g, b }: RGB): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, "0").toUpperCase()).join("")}`;
}

/** Mix two hex colors: `weight` is the fraction of `a` (0..1). */
function mix(a: string, b: string, weight: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const t = Math.max(0, Math.min(1, weight));
  return toHex({ r: ca.r * t + cb.r * (1 - t), g: ca.g * t + cb.g * (1 - t), b: ca.b * t + cb.b * (1 - t) });
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: h * 360, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const hh = (((h % 360) + 360) % 360) / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return toHex({ r: channel(hh + 1 / 3) * 255, g: channel(hh) * 255, b: channel(hh - 1 / 3) * 255 });
}

/** Tertiary accent: seed hue rotated +60°, like Material You's tonal offset. */
function tertiaryBase(seed: string): string {
  const { h, s, l } = hexToHsl(seed);
  return hslToHex(h + 60, Math.min(1, s * 0.9 + 0.1), Math.min(0.55, Math.max(0.35, l)));
}

/**
 * Material-You-style tonal tokens derived from a seed color.
 * Covers the primary, secondary, and tertiary families so the whole UI
 * re-themes without touching every component.
 */
export function seedTokens(seed: string, theme: Theme) {
  const s = normalizeSeed(seed) ?? DEFAULT_SEED;
  // Secondary: same hue as the seed, muted toward gray (low chroma).
  const muted = mix(s, "#8A8A8E", 0.55);
  const t = tertiaryBase(s);
  if (theme === "dark") {
    const primary = mix(s, "#FFFFFF", 0.32);
    const secondary = mix(muted, "#FFFFFF", 0.3);
    const tertiary = mix(t, "#FFFFFF", 0.32);
    const surface = mix("#141218", s, 0.93);
    return {
      seed: s,
      primary,
      onPrimary: mix(s, "#000000", 0.72),
      primaryContainer: mix(s, "#000000", 0.72),
      onPrimaryContainer: mix(s, "#FFFFFF", 0.12),
      inversePrimary: mix(s, "#000000", 0.85),
      secondary,
      onSecondary: mix(muted, "#000000", 0.75),
      secondaryContainer: mix(muted, "#000000", 0.68),
      onSecondaryContainer: mix(muted, "#FFFFFF", 0.12),
      tertiary,
      onTertiary: mix(t, "#000000", 0.72),
      tertiaryContainer: mix(t, "#000000", 0.68),
      onTertiaryContainer: mix(t, "#FFFFFF", 0.12),
      surfaceDim: mix("#141218", s, 0.93),
      surfaceBright: mix("#3B383E", s, 0.88),
      surfaceLowest: mix("#0F0D13", s, 0.94),
      surfaceLow: mix("#1D1B20", s, 0.9),
      surfaceContainer: mix("#211F26", s, 0.89),
      surfaceHigh: mix("#2B2930", s, 0.88),
      surfaceHighest: mix("#36343B", s, 0.87),
      surfaceVariant: mix("#49454F", s, 0.85),
      background: surface,
      surface,
    };
  }
  const primary = mix(s, "#000000", 0.88);
  const secondary = mix(muted, "#000000", 0.85);
  const tertiary = mix(t, "#000000", 0.85);
  const surface = mix("#FEF7FF", s, 0.96);
  return {
    seed: s,
    primary,
    onPrimary: "#FFFFFF",
    primaryContainer: mix(s, "#FFFFFF", 0.18),
    onPrimaryContainer: mix(s, "#000000", 0.45),
    inversePrimary: mix(s, "#FFFFFF", 0.32),
    secondary,
    onSecondary: "#FFFFFF",
    secondaryContainer: mix(muted, "#FFFFFF", 0.16),
    onSecondaryContainer: mix(muted, "#000000", 0.5),
    tertiary,
    onTertiary: "#FFFFFF",
    tertiaryContainer: mix(t, "#FFFFFF", 0.16),
    onTertiaryContainer: mix(t, "#000000", 0.5),
    surfaceDim: mix("#DED8E1", s, 0.94),
    surfaceBright: "#FEF7FF",
    surfaceLowest: "#FFFFFF",
    surfaceLow: mix("#F7F2FA", s, 0.95),
    surfaceContainer: mix("#F3EDF7", s, 0.95),
    surfaceHigh: mix("#ECE6F0", s, 0.94),
    surfaceHighest: mix("#E6E0E9", s, 0.93),
    surfaceVariant: mix("#E7E0EC", s, 0.92),
    background: surface,
    surface,
  };
}

export function storedSeed(): string {
  try {
    return normalizeSeed(window.localStorage.getItem(SEED_KEY)) ?? DEFAULT_SEED;
  } catch {
    return DEFAULT_SEED;
  }
}

/** Theme + seed as last persisted on this device (used by standalone routes). */
export function themeFromStorage(): { theme: Theme; seed: string } {
  try {
    const t = window.localStorage.getItem(THEME_KEY);
    return { theme: t === "light" ? "light" : "dark", seed: storedSeed() };
  } catch {
    return { theme: "dark", seed: DEFAULT_SEED };
  }
}

/** Single place that applies the theme: DOM attribute + seed tokens + persisted for pre-hydration. */
export function applyTheme(theme: Theme, seed?: string) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  const tokens = seedTokens(seed ?? storedSeed(), theme);
  const vars: Array<[string, string]> = [
    ["--seed", tokens.seed],
    ["--md-sys-color-primary", tokens.primary],
    ["--md-sys-color-on-primary", tokens.onPrimary],
    ["--md-sys-color-primary-container", tokens.primaryContainer],
    ["--md-sys-color-on-primary-container", tokens.onPrimaryContainer],
    ["--md-sys-color-inverse-primary", tokens.inversePrimary],
    ["--md-sys-color-secondary", tokens.secondary],
    ["--md-sys-color-on-secondary", tokens.onSecondary],
    ["--md-sys-color-secondary-container", tokens.secondaryContainer],
    ["--md-sys-color-on-secondary-container", tokens.onSecondaryContainer],
    ["--md-sys-color-tertiary", tokens.tertiary],
    ["--md-sys-color-on-tertiary", tokens.onTertiary],
    ["--md-sys-color-tertiary-container", tokens.tertiaryContainer],
    ["--md-sys-color-on-tertiary-container", tokens.onTertiaryContainer],
    ["--md-sys-color-background", tokens.background],
    ["--md-sys-color-surface", tokens.surface],
    ["--md-sys-color-surface-dim", tokens.surfaceDim],
    ["--md-sys-color-surface-bright", tokens.surfaceBright],
    ["--md-sys-color-surface-container-lowest", tokens.surfaceLowest],
    ["--md-sys-color-surface-container-low", tokens.surfaceLow],
    ["--md-sys-color-surface-container", tokens.surfaceContainer],
    ["--md-sys-color-surface-container-high", tokens.surfaceHigh],
    ["--md-sys-color-surface-container-highest", tokens.surfaceHighest],
    ["--md-sys-color-surface-variant", tokens.surfaceVariant],
  ];
  for (const [name, value] of vars) root.style.setProperty(name, value);
  try {
    window.localStorage.setItem(THEME_KEY, theme);
    window.localStorage.setItem(SEED_KEY, tokens.seed);
  } catch {
    // Private browsing etc. — theme still applies for this session.
  }
}
