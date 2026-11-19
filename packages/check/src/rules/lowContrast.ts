import { contrast } from "@keel/ui/css";
import { type JSXAttributeItem, Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { str } from "../internal/str.ts";
import type { RuleDef } from "../types/RuleDef.ts";

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const SCHEMES = ["light", "dark"] as const;
const isRec = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null;

/** The string value of a JSX attribute written as `name="x"` or `name={"x"}`, or undefined. */
function literal(attrs: readonly JSXAttributeItem[], name: string): string | undefined {
  for (const a of attrs) {
    if (a.type !== "JSXAttribute" || a.name.type !== "JSXIdentifier" || a.name.name !== name) continue;
    const v = a.value;
    if (v?.type === "Literal" && typeof v.value === "string") return v.value;
    if (v?.type === "JSXExpressionContainer" && v.expression.type === "Literal") {
      const inner = v.expression.value;
      return typeof inner === "string" ? inner : undefined;
    }
  }
  return undefined;
}

/** A color token's hex in `scheme`, or undefined (unknown token, non-hex value). */
function colorIn(tokens: unknown, name: string, scheme: (typeof SCHEMES)[number]): string | undefined {
  const color = isRec(tokens) ? tokens.color : undefined;
  const v = isRec(color) ? color[name] : undefined;
  const hex = isRec(v) ? v[scheme] : v;
  return typeof hex === "string" && HEX.test(hex) ? hex : undefined;
}

/** A `fontSize` token's pixel size, or 0 when unknown. */
function pixels(tokens: unknown, name: string | undefined): number {
  const sizes = isRec(tokens) ? tokens.fontSize : undefined;
  const v = name !== undefined && isRec(sizes) ? sizes[name] : undefined;
  const m = typeof v === "string" ? /^(\d+(?:\.\d+)?)px$/.exec(v) : null;
  return m?.[1] === undefined ? 0 : Number(m[1]);
}

/** A `weight` token's numeric weight, or 0 when unknown. */
function weightOf(tokens: unknown, name: string | undefined): number {
  const weights = isRec(tokens) ? tokens.weight : undefined;
  const v = name !== undefined && isRec(weights) ? weights[name] : undefined;
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
}

/**
 * E1804 (k.a11y): an element whose `fg` token contrasts below 4.5:1 (3:1 when large: `fontSize` >= 24px, or
 * >= 18.66px at `weight` >= 700) in either color scheme against its `bg`, else the nearest ancestor's `bg` in the
 * same component. With neither, or a `bg` that is not a literal, it is left to the render check; `states` are not
 * read, so text under `states.disabled` is exempt. Tokens come from the `tokens` project artifact; without it the
 * rule reports nothing.
 */
export const lowContrast: RuleDef = {
  code: "E1804",
  message: (f) =>
    `fg "${str(f.data, "fg")}" on bg "${str(f.data, "bg")}" is ${str(f.data, "ratio")}:1 in ${str(f.data, "scheme")}`,
  explain: "Text needs 4.5:1 (3:1 when large) against its own or its nearest ancestor's bg, in light and dark.",
  see: "k.a11y",
  check: ({ file, ast, artifacts }) => {
    const tokens = artifacts.tokens;
    if (!isAppPath(file.path) || tokens === undefined) return [];
    const out: ReturnType<typeof findingAt>[] = [];
    // The `bg` of each open JSX element: its literal, null when not a literal, undefined when it has none.
    const bgs: (string | null | undefined)[] = [];
    new Visitor({
      JSXElement: (el) => {
        const n = el.openingElement;
        const own = n.attributes.some(
          (a) => a.type === "JSXAttribute" && a.name.type === "JSXIdentifier" && a.name.name === "bg",
        )
          ? (literal(n.attributes, "bg") ?? null)
          : undefined;
        const bg = own !== undefined ? own : [...bgs].reverse().find((b) => b !== undefined);
        bgs.push(own);
        const fg = literal(n.attributes, "fg");
        if (fg === undefined || typeof bg !== "string") return;
        const px = pixels(tokens, literal(n.attributes, "fontSize"));
        const large = px >= 24 || (px >= 18.66 && weightOf(tokens, literal(n.attributes, "weight")) >= 700);
        const min = large ? 3 : 4.5;
        for (const scheme of SCHEMES) {
          const a = colorIn(tokens, fg, scheme);
          const b = colorIn(tokens, bg, scheme);
          if (a === undefined || b === undefined) continue;
          const ratio = contrast(a, b);
          if (ratio >= min) continue;
          out.push(findingAt(file, n.start, { fg, bg, scheme, ratio: ratio.toFixed(2) }));
          return;
        }
      },
      "JSXElement:exit": () => {
        bgs.pop();
      },
    }).visit(ast);
    return out;
  },
};
