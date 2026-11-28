// Helpers for the base and look conformance (not a test file). Public API only. Property seed: 1337.
// The `base` and `look` token groups are written through JSON so a fixture the author could write in `tokens.ts` type-checks
// before `Tokens` names the groups; when it does, a builder may pass the literals to `defineTokens` directly.
import { defineTokens } from "@keel/ui/tokens";
import { compileStyles } from "@keel/ui/css";
import { norm, tokens } from "./fixtures.ts";

export type Loose = Readonly<Record<string, unknown>>;

/** The k.ui fixture tokens plus a `size` group and the `extra` groups (`base`, `look`, ...). */
export const withGroups = (extra: Loose) =>
  defineTokens(
    JSON.parse(
      JSON.stringify({
        ...tokens,
        size: { full: "100%" },
        weight: { semibold: "600" },
        ...extra,
      }),
    ),
  );

/** `compileStyles` over tokens and usages written as plain data (a usage may name a `look`). */
export const compileWith = (extra: Loose, usages: readonly Loose[]): { classes: string[][]; css: string } =>
  compileStyles(JSON.parse(JSON.stringify({ tokens: withGroups(extra), usages })));

/** The code a call throws, or null. */
export const codeOf = (f: () => unknown): unknown => {
  try {
    f();
    return null;
  } catch (e) {
    return e instanceof Error && "code" in e ? e.code : null;
  }
};

/** The body of the first `@layer keel.base{...}` block of normalized css, or null. */
export const baseLayer = (css: string): string | null => {
  const n = norm(css);
  const at = n.indexOf("@layer keel.base{");
  if (at < 0) return null;
  const open = n.indexOf("{", at);
  let depth = 1;
  let i = open + 1;
  while (i < n.length && depth > 0) {
    if (n[i] === "{") depth++;
    else if (n[i] === "}") depth--;
    i++;
  }
  return n.slice(open + 1, i - 1);
};

/** Normalized css with the `keel.base` layer block removed (what is left is custom properties, media and atomic rules). */
export const outsideBaseLayer = (css: string): string => {
  const n = norm(css);
  const at = n.indexOf("@layer keel.base{");
  if (at < 0) return n;
  const open = n.indexOf("{", at);
  let depth = 1;
  let i = open + 1;
  while (i < n.length && depth > 0) {
    if (n[i] === "{") depth++;
    else if (n[i] === "}") depth--;
    i++;
  }
  return n.slice(0, at) + n.slice(i);
};

/** The declarations of the first rule whose selector is exactly `selector` in normalized css, or null. */
export const ruleBody = (normalized: string, selector: string): string | null => {
  const at = normalized.search(new RegExp(`(^|[};{])${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\{`));
  if (at < 0) return null;
  const open = normalized.indexOf("{", at);
  return normalized.slice(open + 1, normalized.indexOf("}", open));
};

/** One `base` set per role, each a plain style set over the fixture tokens. */
export const ROLES = {
  heading: { font: "body", fontSize: "lg", weight: "semibold", fg: "fg" },
  link: { fg: "fg", states: { hover: { fg: "accent" } } },
  button: { font: "body", fontSize: "sm", bg: "fg", fg: "bg", px: "2", states: { hover: { bg: "accent" } } },
  control: { font: "body", fontSize: "sm", fg: "fg", bg: "bg", px: "2" },
  label: { font: "body", fontSize: "sm", fg: "fg" },
  fieldError: { font: "body", fontSize: "sm", fg: "accent" },
  summary: { font: "body", fontSize: "sm", fg: "accent", bg: "bg" },
} as const;

/** The role classes base elements carry, by `base` role. */
export const ROLE_CLASS: Readonly<Record<string, string>> = {
  heading: ".k-heading",
  link: ".k-link",
  button: ".k-button",
  control: ".k-control",
  label: ".k-label",
  fieldError: ".k-error",
  summary: ".k-summary",
};

/** The body of the first `@layer <name>{...}` block of normalized css (`name` as written, `keel.theme`), or null. */
export const layerBody = (css: string, name: string): string | null => {
  const n = norm(css);
  const at = n.indexOf(`@layer ${name}{`);
  if (at < 0) return null;
  const open = n.indexOf("{", at);
  let depth = 1;
  let i = open + 1;
  while (i < n.length && depth > 0) {
    if (n[i] === "{") depth++;
    else if (n[i] === "}") depth--;
    i++;
  }
  return n.slice(open + 1, i - 1);
};

/** For each occurrence of `needle` in normalized css, the preludes of the blocks around it, outermost first (`@layer keel.theme`, `@media screen and(...)`, a selector). */
export const enclosing = (css: string, needle: string): string[][] => {
  const n = norm(css);
  const out: string[][] = [];
  const stack: string[] = [];
  let start = 0;
  for (let i = 0; i < n.length; i++) {
    if (n.startsWith(needle, i)) out.push([...stack]);
    const c = n[i];
    if (c === "{") {
      stack.push(n.slice(start, i));
      start = i + 1;
    } else if (c === "}" || c === ";") {
      if (c === "}") stack.pop();
      start = i + 1;
    }
  }
  return out;
};
