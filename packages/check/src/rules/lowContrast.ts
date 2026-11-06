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

/**
 * E1804 (k.ui): an element whose `fg` and `bg` token props contrast below 4.5:1 (3:1 at `fontSize` >= 24px) in
 * either color scheme. Tokens come from the `tokens` project artifact; without it the rule reports nothing.
 */
export const lowContrast: RuleDef = {
  code: "E1804",
  message: (f) =>
    `fg "${str(f.data, "fg")}" on bg "${str(f.data, "bg")}" is ${str(f.data, "ratio")}:1 in ${str(f.data, "scheme")}`,
  explain: "fg/bg need 4.5:1 contrast (3:1 at fontSize >= 24px) in light and dark. Pick token colors that pass.",
  see: "k.ui",
  check: ({ file, ast, artifacts }) => {
    const tokens = artifacts.tokens;
    if (!isAppPath(file.path) || tokens === undefined) return [];
    const out: ReturnType<typeof findingAt>[] = [];
    new Visitor({
      JSXOpeningElement: (n) => {
        const fg = literal(n.attributes, "fg");
        const bg = literal(n.attributes, "bg");
        if (fg === undefined || bg === undefined) return;
        const min = pixels(tokens, literal(n.attributes, "fontSize")) >= 24 ? 3 : 4.5;
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
    }).visit(ast);
    return out;
  },
};
