// Shared fixtures for k.ui conformance. Property seed: 1337.
// Assumed: `compileStyles` from '@keel/ui/css' is pure, takes { tokens, usages: { props, breakpoint?, state? }[] } and returns { classes: string[][], css: string }; the compiler calls it.
// Assumed: `contrast(fg, bg)` from '@keel/ui/css' takes two hex colors and returns the WCAG ratio.
// Axe proper (axe-core) arrives with @keel/testing; `a11yViolations` below is a minimal structural stand-in.
import { defineTokens } from "@keel/ui";

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

const hasText = (e: Element): boolean => (e.textContent ?? "").trim().length > 0;
const labelled = (e: Element, root: Element): boolean => {
  const aria = e.getAttribute("aria-label");
  if (aria !== null && aria.trim().length > 0) return true;
  const id = e.getAttribute("id");
  if (id === null || id === "") return false;
  for (const l of Array.from(root.querySelectorAll("label"))) {
    if (l.getAttribute("for") === id && hasText(l)) return true;
  }
  return false;
};

/** Minimal structural a11y check; returns violation descriptions. */
export const a11yViolations = (root: Element): string[] => {
  const v: string[] = [];
  for (const e of Array.from(root.querySelectorAll("img"))) {
    if (!e.hasAttribute("alt") && e.getAttribute("role") !== "presentation") v.push("img-alt");
  }
  for (const e of Array.from(root.querySelectorAll("input, textarea, select"))) {
    if (e.getAttribute("type") === "hidden") continue;
    if (!labelled(e, root)) v.push(`control-label:${e.tagName.toLowerCase()}`);
  }
  for (const e of Array.from(root.querySelectorAll("h1, h2, h3, h4, h5, h6, [role=heading]"))) {
    const lvl = e.getAttribute("aria-level");
    if (!/^h[1-6]$/i.test(e.tagName) && lvl === null) v.push("heading-level");
  }
  for (const e of Array.from(root.querySelectorAll("button"))) {
    const aria = e.getAttribute("aria-label");
    if (!hasText(e) && (aria === null || aria.trim() === "")) v.push("button-name");
  }
  for (const e of Array.from(root.querySelectorAll("a"))) {
    const aria = e.getAttribute("aria-label");
    if (!hasText(e) && (aria === null || aria.trim() === "")) v.push("link-name");
  }
  return v;
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
