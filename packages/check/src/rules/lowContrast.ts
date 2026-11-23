import { contrast } from "@keel/ui/css";
import { type JSXAttributeItem, type JSXChild, Visitor } from "oxc-parser";
import { BASE_ROLE } from "../internal/BASE_ROLE.ts";
import { clip } from "../internal/clip.ts";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { str } from "../internal/str.ts";
import { tokenSetAt } from "../internal/tokenSetAt.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const SCHEMES = ["light", "dark"] as const;
/** The user agent's text and canvas, where neither the element nor `base.page` names a color. */
const UA_FG = "#000000";
const UA_BG = "#FFFFFF";
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

/** Whether the attribute `name` is written at all. */
const has = (attrs: readonly JSXAttributeItem[], name: string): boolean =>
  attrs.some((a) => a.type === "JSXAttribute" && a.name.type === "JSXIdentifier" && a.name.name === name);

/** A color token's hex in `scheme` (a hex is taken as is), or undefined (unknown token, non-hex value). */
function colorIn(tokens: unknown, name: string, scheme: (typeof SCHEMES)[number]): string | undefined {
  if (HEX.test(name)) return name;
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

/** A token set's unconditioned token for `prop` (a responsive value's `base`), or undefined. */
function setToken(set: unknown, prop: string): string | undefined {
  const v = isRec(set) ? set[prop] : undefined;
  if (typeof v === "string") return v;
  const base = isRec(v) ? v.base : undefined;
  return typeof base === "string" ? base : undefined;
}

/** The first scheme where `fg` on `bg` falls below its threshold, as finding data, or undefined. */
function failing(
  tokens: unknown,
  fg: string,
  bg: string,
  size: string | undefined,
  weight: string | undefined,
): Readonly<Record<string, string>> | undefined {
  const px = pixels(tokens, size);
  const min = px >= 24 || (px >= 18.66 && weightOf(tokens, weight) >= 700) ? 3 : 4.5;
  for (const scheme of SCHEMES) {
    const a = colorIn(tokens, fg, scheme);
    const b = colorIn(tokens, bg, scheme);
    if (a === undefined || b === undefined) continue;
    const ratio = contrast(a, b);
    if (ratio < min) return { fg, bg, scheme, ratio: ratio.toFixed(2) };
  }
  return undefined;
}

/** Whether an element holds text of its own: non-blank text or an expression child. */
const ownsText = (kids: readonly JSXChild[]): boolean =>
  kids.some(
    (k) =>
      (k.type === "JSXText" && k.value.trim() !== "") ||
      (k.type === "JSXExpressionContainer" && k.expression.type !== "JSXEmptyExpression"),
  );

/**
 * E1804 (k.a11y): text whose `fg` contrasts below 4.5:1 (3:1 when large: `fontSize` >= 24px, or >= 18.66px at
 * `weight` >= 700) in either color scheme against its `bg`. An element's `fg`, `bg`, `fontSize` and `weight` are its
 * own literal props, else its role's `base` set (`Heading` heading, `Link` link, `Button` button, `Input`, `TextArea`
 * and `Select` control); `bg` then falls back to the nearest ancestor's in the same component, then `base.page`'s
 * (with none it is left to the render check), and `fg` to `base.page`'s, else the user agent's black. An element is judged when it writes `fg`, or writes `bg` and
 * holds text, or takes a role `fg` that lands on an ancestor's `bg`; a non-literal color is left to the render check.
 * Each `base` set (on its own `bg`, else `base.page`'s, else white) and each look is judged too, at the project's `tokens.ts`
 * (else its first file). `states` are not read, so text under `states.disabled` is exempt. Tokens come from the
 * `tokens` project artifact; without it the rule reports nothing.
 */
export const lowContrast: RuleDef = {
  code: "E1804",
  message: (f) => {
    const set = str(f.data, "set");
    const pair = `fg "${str(f.data, "fg")}" on bg "${str(f.data, "bg")}"`;
    const tail = `is ${str(f.data, "ratio")}:1 in ${str(f.data, "scheme")}`;
    return set === "" ? `${pair} ${tail}` : clip(`${set}: ${pair} ${tail}`, 89);
  },
  see: "k.a11y",
  check: ({ file, ast, artifacts, project }) => {
    const tokens = artifacts.tokens;
    if (tokens === undefined) return [];
    const out: Finding[] = [];
    const base = isRec(tokens) && isRec(tokens.base) ? tokens.base : {};
    const page = base.page;
    const pageFg = setToken(page, "fg") ?? UA_FG;
    const pageBgSet = setToken(page, "bg");
    const pageBg = pageBgSet ?? UA_BG;
    const sets: [string, unknown][] = Object.entries(base)
      .filter(([name]) => name !== "focus")
      .map(([name, set]) => [`base.${name}`, set]);
    if (isRec(tokens) && isRec(tokens.look))
      for (const [name, set] of Object.entries(tokens.look)) sets.push([`look.${name}`, set]);
    for (const [label, set] of sets) {
      const fg = setToken(set, "fg");
      const bg = setToken(set, "bg");
      if (fg === undefined && bg === undefined) continue;
      const bad = failing(tokens, fg ?? pageFg, bg ?? pageBg, setToken(set, "fontSize"), setToken(set, "weight"));
      const at = bad === undefined ? undefined : tokenSetAt(file, project, label);
      if (at !== undefined) out.push(findingAt(file, at, { ...bad, set: label }));
    }
    if (!isAppPath(file.path)) return out;
    // The `bg` of each open JSX element: its literal or its role's, null when not a literal, undefined when none.
    const bgs: (string | null | undefined)[] = [];
    new Visitor({
      JSXElement: (el) => {
        const n = el.openingElement;
        const name = n.name.type === "JSXIdentifier" ? n.name.name : "";
        const roleName = BASE_ROLE[name];
        const role = roleName === undefined ? undefined : base[roleName];
        const ownBg = has(n.attributes, "bg") ? (literal(n.attributes, "bg") ?? null) : undefined;
        const ownFg = has(n.attributes, "fg") ? (literal(n.attributes, "fg") ?? null) : undefined;
        const mine = ownBg !== undefined ? ownBg : setToken(role, "bg");
        const inherited = [...bgs].reverse().find((b) => b !== undefined);
        bgs.push(mine);
        const roleFg = setToken(role, "fg");
        const fg = ownFg !== undefined ? ownFg : (roleFg ?? pageFg);
        const bg = mine !== undefined ? mine : (inherited ?? pageBgSet);
        const judged =
          ownFg !== undefined ||
          (ownBg !== undefined && ownsText(el.children)) ||
          (roleFg !== undefined && mine === undefined && inherited !== undefined);
        if (!judged || fg === null || bg === null || bg === undefined) return;
        const size = literal(n.attributes, "fontSize") ?? setToken(role, "fontSize");
        const weight = literal(n.attributes, "weight") ?? setToken(role, "weight");
        const bad = failing(tokens, fg, bg, size, weight);
        if (bad !== undefined) out.push(findingAt(file, n.start, bad));
      },
      "JSXElement:exit": () => {
        bgs.pop();
      },
    }).visit(ast);
    return out;
  },
};
