import { clipMessage } from "@keel/schema/internal";
import { contrast } from "@keel/ui/css";
import { type Expression, type JSXAttribute, type JSXAttributeItem, type JSXChild, Visitor } from "oxc-parser";
import { BASE_ELEMENTS } from "../internal/BASE_ELEMENTS.ts";
import { BASE_ROLE } from "../internal/BASE_ROLE.ts";
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

/** A style value: a token name, `null` when written in a way check does not read, `undefined` when not found. */
type Value = string | null | undefined;
type Frame = {
  readonly fg: Value;
  readonly bg: Value;
  readonly fontSize: Value;
  readonly weight: Value;
  readonly exempt: boolean;
};
const PROPS = ["fg", "bg", "fontSize", "weight"] as const;
/** The end of a chain: the component's edge, or below another component, whose markup another file holds. */
const EDGE: Frame = { fg: undefined, bg: undefined, fontSize: undefined, weight: undefined, exempt: false };
/** Elements that take style props, and the intrinsics that add no markup, so values pass through them. */
const STYLED = new Set([...BASE_ELEMENTS, "Part"]);
const PASS = new Set(["If", "For", "Match", "Case", "Boundary"]);

/** The last attribute named `name`, with its index, or undefined. */
function attr(attrs: readonly JSXAttributeItem[], name: string): [JSXAttribute, number] | undefined {
  let hit: [JSXAttribute, number] | undefined;
  attrs.forEach((a, i) => {
    if (a.type === "JSXAttribute" && a.name.type === "JSXIdentifier" && a.name.name === name) hit = [a, i];
  });
  return hit;
}

/**
 * The prop `name` as written: its string literal, `null` when written another way or when a spread follows it or
 * stands in for it, `"absent"` when not written.
 */
function written(attrs: readonly JSXAttributeItem[], name: string): string | null | "absent" {
  let spread = -1;
  attrs.forEach((a, i) => {
    if (a.type === "JSXSpreadAttribute") spread = i;
  });
  const hit = attr(attrs, name);
  if (hit === undefined) return spread >= 0 ? null : "absent";
  const [a, i] = hit;
  if (i < spread) return null;
  const v = a.value;
  if (v?.type === "Literal" && typeof v.value === "string") return v.value;
  if (v?.type === "JSXExpressionContainer" && v.expression.type === "Literal" && typeof v.expression.value === "string")
    return v.expression.value;
  return null;
}

/** Whether a boolean attribute is written bare or `{true}`. */
function on(attrs: readonly JSXAttributeItem[], name: string): boolean {
  const v = attr(attrs, name)?.[0].value;
  if (v === undefined) return false;
  if (v === null) return true;
  return v.type === "JSXExpressionContainer" && v.expression.type === "Literal" && v.expression.value === true;
}

/** Whether an expression child renders as text: not JSX, a function, a `.map(...)` call, or a branch that is one. */
function textLike(e: Expression): boolean {
  switch (e.type) {
    case "JSXElement":
    case "JSXFragment":
    case "ArrowFunctionExpression":
    case "FunctionExpression":
      return false;
    case "ParenthesizedExpression":
      return textLike(e.expression);
    case "Literal":
      return typeof e.value !== "string" || e.value.trim() !== "";
    case "ConditionalExpression":
      return textLike(e.consequent) && textLike(e.alternate);
    case "LogicalExpression":
      return textLike(e.left) && textLike(e.right);
    case "CallExpression":
      return !(
        e.callee.type === "MemberExpression" &&
        !e.callee.computed &&
        e.callee.property.type === "Identifier" &&
        e.callee.property.name === "map"
      );
    default:
      return true;
  }
}

/** Whether an element holds text: a JSX text child with a non-space character, or a text-like expression child. */
const holdsText = (kids: readonly JSXChild[]): boolean =>
  kids.some(
    (k) =>
      (k.type === "JSXText" && k.value.trim() !== "") ||
      (k.type === "JSXExpressionContainer" && k.expression.type !== "JSXEmptyExpression" && textLike(k.expression)),
  );

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
  size: string | null | undefined,
  weight: string | null | undefined,
): Readonly<Record<string, string>> | undefined {
  // An unread size or weight is judged at 3:1, which text of every size needs.
  const px = size === null || weight === null ? 24 : pixels(tokens, size);
  const min = px >= 24 || (px >= 18.66 && weightOf(tokens, weight ?? undefined) >= 700) ? 3 : 4.5;
  for (const scheme of SCHEMES) {
    const a = colorIn(tokens, fg, scheme);
    const b = colorIn(tokens, bg, scheme);
    if (a === undefined || b === undefined) continue;
    const ratio = contrast(a, b);
    if (ratio < min) return { fg, bg, scheme, ratio: ratio.toFixed(2), need: String(min) };
  }
  return undefined;
}

/**
 * E1804 (k.a11y, k.a11y-static): text whose `fg` contrasts below 4.5:1 (3:1 when large: `fontSize` >= 24px, or
 * >= 18.66px at `weight` >= 700) in either color scheme against its `bg`. Each `base` set (on its own `bg`, else
 * `base.page`'s, else white) and each look is judged at the project's `tokens.ts` (else its first file). In an app
 * file, a base element or `Part` holding text is judged with its `fg`, `bg`, `fontSize` and `weight` resolved as the
 * render check resolves them: its own literal prop, its literal look's set, its role's `base` set, then its parent's
 * through base elements, `Part` and the intrinsics that add no markup. At the component's edge or below another
 * component `bg` is not found and the rest are `base.page`'s; an element whose `fg` or `bg` is unread (an expression,
 * a responsive object, a computed look, a spread) or not found is left to the render check; an unread size judges at
 * 3:1. Text under a `hidden`, `disabled` (bare or `{true}`) or `aria-disabled="true"` element is exempt, and `states`
 * are not read. Tokens come from the `tokens` project artifact; without it the rule reports nothing.
 */
export const lowContrast: RuleDef = {
  code: "E1804",
  message: (f) => {
    const set = str(f.data, "set");
    const pair = `fg "${str(f.data, "fg")}" on bg "${str(f.data, "bg")}"`;
    const tail = `is ${str(f.data, "ratio")}:1 in ${str(f.data, "scheme")}, needs ${str(f.data, "need")}:1`;
    return clipMessage(set === "" ? `${pair} ${tail}` : `${set}: ${pair} ${tail}`, 89);
  },
  see: "k.a11y",
  check: ({ file, ast, artifacts, project }) => {
    const tokens = artifacts.tokens;
    if (tokens === undefined) return [];
    const out: Finding[] = [];
    const base = isRec(tokens) && isRec(tokens.base) ? tokens.base : {};
    const page = base.page;
    const pageFg = setToken(page, "fg") ?? UA_FG;
    const pageBg = setToken(page, "bg") ?? UA_BG;
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
    const pageSize = setToken(page, "fontSize");
    const pageWeight = setToken(page, "weight");
    const looks = isRec(tokens) && isRec(tokens.look) ? tokens.look : {};
    const frames: Frame[] = [];
    new Visitor({
      JSXElement: (el) => {
        const n = el.openingElement;
        const name = n.name.type === "JSXIdentifier" ? n.name.name : "";
        const parent = frames.at(-1) ?? EDGE;
        if (!STYLED.has(name)) {
          frames.push(PASS.has(name) ? parent : EDGE);
          return;
        }
        const roleName = BASE_ROLE[name];
        const role = roleName === undefined ? undefined : base[roleName];
        const look = written(n.attributes, "look");
        const set = typeof look === "string" && look !== "absent" ? looks[look] : undefined;
        const resolve = (prop: (typeof PROPS)[number]): Value => {
          const own = written(n.attributes, prop);
          if (own !== "absent") return own;
          if (look === null) return null;
          return setToken(set, prop) ?? setToken(role, prop) ?? parent[prop];
        };
        const exempt =
          parent.exempt ||
          on(n.attributes, "hidden") ||
          on(n.attributes, "disabled") ||
          written(n.attributes, "aria-disabled") === "true";
        const frame: Frame = {
          fg: resolve("fg"),
          bg: resolve("bg"),
          fontSize: resolve("fontSize"),
          weight: resolve("weight"),
          exempt,
        };
        frames.push(frame);
        if (exempt || !holdsText(el.children)) return;
        const fg = frame.fg === undefined ? pageFg : frame.fg;
        if (fg === null || frame.bg === null || frame.bg === undefined) return;
        const size = frame.fontSize === undefined ? pageSize : frame.fontSize;
        const weight = frame.weight === undefined ? pageWeight : frame.weight;
        const bad = failing(tokens, fg, frame.bg, size, weight);
        if (bad !== undefined) out.push(findingAt(file, n.start, bad));
      },
      "JSXElement:exit": () => {
        frames.pop();
      },
    }).visit(ast);
    return out;
  },
};
