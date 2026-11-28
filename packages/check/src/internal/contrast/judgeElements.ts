import type { Expression, JSXAttribute, JSXAttributeItem, JSXChild, Program } from "oxc-parser";
import { Visitor } from "oxc-parser";
import { BASE_ELEMENTS } from "../BASE_ELEMENTS.ts";
import { BASE_ROLE } from "../BASE_ROLE.ts";
import type { Combo } from "./Combo.ts";
import { failing } from "./failing.ts";
import { overOf } from "./overOf.ts";
import { setToken } from "./setToken.ts";

/** The user agent's text, where neither the element nor `base.page` names a color. */
const UA_FG = "#000000";
const isRec = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null;

/** A style value: a token name, `null` when written in a way check does not read, `undefined` when not found. */
type Value = string | null | undefined;
type Frame = {
  readonly fg: Value;
  readonly bg: Value;
  readonly fontSize: Value;
  readonly weight: Value;
  readonly exempt: boolean;
  /** The scheme a `Box scheme` the chain passes fixes (k.aria Scheme), or undefined. */
  readonly scheme: "light" | "dark" | undefined;
  /** A `media` the chain passes (k.aria Print), or undefined. */
  readonly media: "screen" | "print" | undefined;
  /** What a `bg` overlay of the chain sits on: the `bg` the chain found under it, or undefined (each of its `over`). */
  readonly under: Value;
};
const PROPS = ["fg", "bg", "fontSize", "weight"] as const;
/** The end of a chain: the component's edge, or below another component, whose markup another file holds. */
const EDGE: Frame = {
  fg: undefined,
  bg: undefined,
  fontSize: undefined,
  weight: undefined,
  exempt: false,
  scheme: undefined,
  media: undefined,
  under: undefined,
};
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

/** The `print` key of a responsive value written as an object literal, when that key is a string literal. */
function printKey(e: Expression): string | null {
  if (e.type !== "ObjectExpression") return null;
  let hit: string | null = null;
  for (const p of e.properties) {
    if (p.type === "SpreadElement") hit = null;
    else if (
      !p.computed &&
      (p.key.type === "Identifier" ? p.key.name : p.key.type === "Literal" ? p.key.value : "") === "print"
    )
      hit = p.value.type === "Literal" && typeof p.value.value === "string" ? p.value.value : null;
  }
  return hit;
}

/**
 * The prop `name` as written: its string literal, `null` when written another way or when a spread follows it or
 * stands in for it, `"absent"` when not written. When `printing`, a responsive value's `print` key written as a string
 * literal (k.themes Combinations).
 */
function written(attrs: readonly JSXAttributeItem[], name: string, printing = false): string | null | "absent" {
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
  if (printing && v?.type === "JSXExpressionContainer" && v.expression.type !== "JSXEmptyExpression")
    return printKey(v.expression);
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

/** The combinations an element is judged in (k.a11y-static Combinations): its scheme's and the printing ones under a `Box scheme`, none printing under `media="screen"`, only those under `media="print"`. */
function combosFor(combos: readonly Combo[], f: Frame): readonly Combo[] {
  return combos.filter((c) => {
    if (f.media === "screen" && c.printing) return false;
    if (f.media === "print" && !c.printing) return false;
    return f.scheme === undefined || c.printing || c.scheme === f.scheme;
  });
}

/** The offset of the value of the last attribute `name`, its opening quote, or undefined. */
function valueAt(attrs: readonly JSXAttributeItem[], name: string): number | undefined {
  const v = attr(attrs, name)?.[0].value;
  return v === null || v === undefined ? undefined : v.start;
}

/**
 * The elements of `ast` holding text whose contrast fails in a combination they are judged in, each with the offset
 * of its `<` and the finding data; and each `bg` overlay sitting on a backdrop its `over` does not hold, or on another
 * overlay (E1817, k.a11y-static Overlays), at the opening quote of its literal.
 */
export function judgeElements(
  ast: Program,
  tokens: unknown,
  combos: readonly Combo[],
): {
  readonly contrast: { at: number; bad: Readonly<Record<string, string>> }[];
  readonly backdrops: { at: number; bad: Readonly<Record<string, string>> }[];
} {
  const out: { at: number; bad: Readonly<Record<string, string>> }[] = [];
  const backdrops: { at: number; bad: Readonly<Record<string, string>> }[] = [];
  const base = isRec(tokens) && isRec(tokens.base) ? tokens.base : {};
  const page = base.page;
  const pageFg = setToken(page, "fg") ?? UA_FG;
  const pageSize = setToken(page, "fontSize");
  const pageWeight = setToken(page, "weight");
  const looks = isRec(tokens) && isRec(tokens.look) ? tokens.look : {};
  const first = combos[0];
  const isOverlay = (name: Value): boolean =>
    typeof name === "string" && first !== undefined && overOf(first, name) !== undefined;
  type Mode = "screen" | "print";
  const stacks: Record<Mode, Frame[]> = { screen: [], print: [] };
  new Visitor({
    JSXElement: (el) => {
      const n = el.openingElement;
      const name = n.name.type === "JSXIdentifier" ? n.name.name : "";
      if (!STYLED.has(name)) {
        for (const m of ["screen", "print"] as const) {
          const parent = stacks[m].at(-1) ?? EDGE;
          stacks[m].push(PASS.has(name) ? parent : EDGE);
        }
        return;
      }
      const roleName = BASE_ROLE[name];
      const role = roleName === undefined ? undefined : base[roleName];
      const look = written(n.attributes, "look");
      const set = typeof look === "string" && look !== "absent" ? looks[look] : undefined;
      const exempt0 =
        on(n.attributes, "hidden") || on(n.attributes, "disabled") || written(n.attributes, "aria-disabled") === "true";
      const sch = name === "Box" ? written(n.attributes, "scheme") : "absent";
      const med = written(n.attributes, "media");
      // Each element is read twice: on screen, where a responsive value stays unread, and printing, where its `print`
      // key is read (k.themes Combinations).
      const frameOf = (m: Mode): Frame => {
        const parent = stacks[m].at(-1) ?? EDGE;
        const resolve = (prop: (typeof PROPS)[number]): Value => {
          const own = written(n.attributes, prop, m === "print");
          if (own !== "absent") return own;
          if (look === null) return null;
          return setToken(set, prop) ?? setToken(role, prop) ?? parent[prop];
        };
        const bg = resolve("bg");
        // A `bg` overlay this element sets sits on the `bg` its parent's chain found (k.a11y-static Overlays).
        const fresh = bg !== parent.bg && isOverlay(bg);
        return {
          fg: resolve("fg"),
          bg,
          fontSize: resolve("fontSize"),
          weight: resolve("weight"),
          exempt: parent.exempt || exempt0,
          scheme: sch === "light" || sch === "dark" ? sch : parent.scheme,
          media: med === "screen" || med === "print" ? med : parent.media,
          under: fresh ? parent.bg : bg === parent.bg ? parent.under : undefined,
        };
      };
      const screenParent = stacks.screen.at(-1) ?? EDGE;
      const frames = { screen: frameOf("screen"), print: frameOf("print") };
      stacks.screen.push(frames.screen);
      stacks.print.push(frames.print);
      const frame = frames.screen;
      const bg = frame.bg;
      const under = frame.under;
      const fresh = bg !== screenParent.bg && isOverlay(bg);
      if (fresh && typeof bg === "string" && typeof under === "string" && first !== undefined) {
        const at = valueAt(n.attributes, "bg") ?? n.start;
        if (isOverlay(under))
          backdrops.push({ at, bad: { prop: "bg", overlay: bg, backdrop: under, kind: "overlay" } });
        else if (!(overOf(first, bg) ?? []).includes(under))
          backdrops.push({ at, bad: { prop: "bg", overlay: bg, backdrop: under, kind: "missing" } });
      }
      if (frame.exempt || !holdsText(el.children)) return;
      const judge = (f: Frame, printing: boolean): Readonly<Record<string, string>> | undefined => {
        const fg = f.fg === undefined ? pageFg : f.fg;
        if (fg === null || f.bg === null || f.bg === undefined || f.under === null) return undefined;
        // A backdrop E1817 reports is not judged for contrast: its composite is no value the tokens allow.
        const misplaced =
          typeof f.under === "string" &&
          first !== undefined &&
          (isOverlay(f.under) || !(overOf(first, f.bg) ?? [f.under]).includes(f.under));
        if (misplaced) return undefined;
        const size = f.fontSize === undefined ? pageSize : f.fontSize;
        const weight = f.weight === undefined ? pageWeight : f.weight;
        const judged = combosFor(combos, f).filter((c) => c.printing === printing);
        return failing(tokens, judged, fg, f.bg, size, weight, f.under);
      };
      const bad = judge(frames.screen, false) ?? judge(frames.print, true);
      if (bad !== undefined) out.push({ at: n.start, bad });
    },
    "JSXElement:exit": () => {
      stacks.screen.pop();
      stacks.print.pop();
    },
  }).visit(ast);
  return { contrast: out, backdrops };
}
