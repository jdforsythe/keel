// Shared fixtures for k.ui conformance. Property seed: 1337.
// Assumed: `compileStyles` from '@keel/ui/css' is pure, takes { tokens, usages: { props, breakpoint?, state? }[] } and returns { classes: string[][], css: string }; the compiler calls it.
// Assumed: `contrast(fg, bg)` from '@keel/ui/css' takes two hex colors and returns the WCAG ratio.
// Axe, style-signal and E1804 check conformance lives in packages/testing/conformance/ui-*.test.ts (rfc:0021).
import { scope } from "@keel/reactive";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { Text } from "@keel/ui";
import { defineTokens } from "@keel/ui/tokens";

export const SEED = 1337;

export const tokens = defineTokens({
  color: { fg: { light: "#111", dark: "#eee" }, bg: { light: "#fff", dark: "#111" }, accent: "#0a5" },
  space: { 0: "0", 1: "4px", 2: "8px", 3: "16px" },
  radius: { 1: "4px" },
  font: { body: "system-ui" },
  fontSize: { sm: "14px", md: "16px", lg: "24px" },
  breakpoint: { md: "768px" },
  motion: { fast: "120ms" },
});

/** One-page contract (k.contract) so `Link to` receives a real `Href`. */
export const ui = contract("ui", { "ui.home": { path: "/" } });
export const routes = manifest(ui, { "ui.home": { component: () => Text({ children: "home" }) } });
export const home = ui.href("ui.home");

/** Runs `fn` inside an ownership scope (k.reactive E1203); `dispose` frees the scope. */
export const inScope = <T>(fn: () => T): { value: T; dispose: () => void } => {
  const slot: T[] = [];
  const sc = scope(
    () => {
      slot.push(fn());
    },
    { detached: true },
  );
  // reduce without a seed yields the single element typed T (throws if fn threw before pushing).
  return { value: slot.reduce((_, x) => x), dispose: () => sc.dispose() };
};

export const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

/** Escapes a class name the way CSS selectors require. */
export const cssEscape = (c: string): string => c.replace(/[^\w-]/g, "\\$&");

/** Counts selector occurrences of class `c` in `css` (not followed by a name character). */
export const countRules = (css: string, c: string): number =>
  css.split(new RegExp(`\\.${cssEscape(c)}(?![\\w-])`)).length - 1;

export const norm = (css: string): string => css.replace(/\s+/g, " ").replace(/\s*([:{};,()])\s*/g, "$1");

/** Returns the body of every top-level `@media` block whose normalized prelude contains `query`. */
export const mediaBlocks = (css: string, query: string): string[] => {
  const n = norm(css);
  const out: string[] = [];
  let from = 0;
  for (;;) {
    const at = n.indexOf("@media", from);
    if (at < 0) return out;
    const open = n.indexOf("{", at);
    if (open < 0) return out;
    let depth = 1;
    let i = open + 1;
    while (i < n.length && depth > 0) {
      if (n[i] === "{") depth++;
      else if (n[i] === "}") depth--;
      i++;
    }
    if (n.slice(at, open).includes(query)) out.push(n.slice(open + 1, i - 1));
    from = i;
  }
};

/** Removes every `@media` block from normalized css. */
export const withoutMedia = (css: string): string => {
  let n = norm(css);
  for (;;) {
    const at = n.indexOf("@media");
    if (at < 0) return n;
    const open = n.indexOf("{", at);
    let depth = 1;
    let i = open + 1;
    while (i < n.length && depth > 0) {
      if (n[i] === "{") depth++;
      else if (n[i] === "}") depth--;
      i++;
    }
    n = n.slice(0, at) + n.slice(i);
  }
};

/** WCAG 2.x relative luminance contrast, computed independently of the implementation. */
export const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const luminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
};
export const ratio = (a: string, b: string): number => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

// ---- the six opaque `<color>` forms of k.values, read from the stated formulas, independently of the implementation.
const sRGBLinear = (c: number, knee: number): number => {
  const a = Math.abs(c);
  return Math.sign(c) * (a <= knee ? a / 12.92 : ((a + 0.055) / 1.055) ** 2.4);
};
const channels = (color: string): string[] => {
  const inner = /\(([^)]*)\)/.exec(color)?.[1] ?? "";
  return inner
    .replace("display-p3", "")
    .trim()
    .split(/\s+/)
    .filter((w) => w !== "");
};
const num = (w: string | undefined): number => Number.parseFloat(w ?? "0");
/** `<l>` of `oklab`/`oklch`: a number from 0 to 1, or a percentage. */
const lightness = (w: string | undefined): number => (w?.endsWith("%") ? num(w) / 100 : num(w));
/** CSS Color 4 `hslToRgb`, h in degrees, s and l in 0..100. */
const hslToRgb = (h0: number, s0: number, l0: number): [number, number, number] => {
  const h = ((h0 % 360) + 360) % 360;
  const s = s0 / 100;
  const l = l0 / 100;
  const f = (n: number): number => {
    const k = (n + h / 30) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
};
const oklabToLinear = (L: number, a: number, b: number): [number, number, number] => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
};
/** The linear sRGB channels of a `<color>` as given (not clamped, not gamut-mapped). */
export const colorLinear = (color: string): [number, number, number] => {
  const w = channels(color);
  if (color.startsWith("#")) {
    const [r, g, b] = hexToRgb(color).map((c) => sRGBLinear(c / 255, 0.03928));
    return [r ?? 0, g ?? 0, b ?? 0];
  }
  if (color.startsWith("rgb(")) {
    const [r, g, b] = [num(w[0]), num(w[1]), num(w[2])].map((c) => sRGBLinear(c / 255, 0.03928));
    return [r ?? 0, g ?? 0, b ?? 0];
  }
  if (color.startsWith("hsl(")) {
    const [r, g, b] = hslToRgb(num(w[0]), num(w[1]), num(w[2]));
    return [sRGBLinear(r, 0.03928), sRGBLinear(g, 0.03928), sRGBLinear(b, 0.03928)];
  }
  if (color.startsWith("oklab(")) return oklabToLinear(lightness(w[0]), num(w[1]), num(w[2]));
  if (color.startsWith("oklch(")) {
    const rad = (num(w[2]) * Math.PI) / 180;
    return oklabToLinear(lightness(w[0]), num(w[1]) * Math.cos(rad), num(w[1]) * Math.sin(rad));
  }
  // color(display-p3 r g b): CSS Color 4's transfer function, then linear P3 to linear sRGB.
  const [pr, pg, pb] = [num(w[0]), num(w[1]), num(w[2])].map((c) => sRGBLinear(c, 0.04045));
  return [
    1.2249401 * (pr ?? 0) - 0.2249404 * (pg ?? 0),
    -0.0420569 * (pr ?? 0) + 1.0420571 * (pg ?? 0),
    -0.0196376 * (pr ?? 0) - 0.0786361 * (pg ?? 0) + 1.0982735 * (pb ?? 0),
  ];
};
/** Whether no linear channel is below 0 or above 1 by more than 0.000001 (k.values Contrast). */
export const inSrgb = (color: string): boolean => colorLinear(color).every((c) => c >= -0.000001 && c <= 1.000001);
/** `0.2126 R + 0.7152 G + 0.0722 B`, clamped to 0..1, of the color as given. */
export const colorLuminance = (color: string): number => {
  const [r, g, b] = colorLinear(color);
  return Math.min(1, Math.max(0, 0.2126 * r + 0.7152 * g + 0.0722 * b));
};
export const colorRatio = (a: string, b: string): number => {
  const la = colorLuminance(a);
  const lb = colorLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
