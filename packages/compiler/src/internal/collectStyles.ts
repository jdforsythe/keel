import { type Expression, type JSXElement, type ObjectExpression, Visitor } from "oxc-parser";
import type { StyleUsage } from "../types/StyleUsage.ts";
import type { Analysis } from "./Analysis.ts";
import type { StyleRewrite } from "./StyleRewrite.ts";
import { attrNameOf } from "./attrNameOf.ts";
import { className } from "./className.ts";
import { staticValueOf } from "./staticValueOf.ts";
import { uiBaseElements } from "./uiBaseElements.ts";

type State = NonNullable<StyleUsage["state"]>;
type Leaf = { prop: string; token: string; breakpoint: string | undefined; state: State | undefined };

const UI = "@keel/ui";
/** Style props in ui's emission order (packages/ui/src/internal/styleProps.ts). */
const STYLE_PROPS: readonly string[] = [
  "p",
  "px",
  "py",
  "m",
  "mx",
  "my",
  "gap",
  "w",
  "h",
  "bg",
  "fg",
  "radius",
  "font",
  "fontSize",
  "weight",
  "shadow",
  "direction",
  "align",
  "justify",
  "wrap",
];
const STATES: readonly State[] = ["hover", "focusVisible", "active", "disabled"];

const isState = (k: string): k is State => STATES.some((s) => s === k);

function unparen(e: Expression): Expression {
  return e.type === "ParenthesizedExpression" ? unparen(e.expression) : e;
}

/** Possible tokens of a value: the literal itself (static), or literal leaves of `?:`/`&&`/`||`/`??` (dynamic). */
function tokensOf(e: Expression): { tokens: string[]; fixed: boolean } {
  const x = unparen(e);
  if (x.type === "Literal" && (typeof x.value === "string" || typeof x.value === "number"))
    return { tokens: [String(x.value)], fixed: true };
  if (x.type === "TemplateLiteral" && x.expressions.length === 0) {
    const cooked = x.quasis[0]?.value.cooked;
    if (typeof cooked === "string") return { tokens: [cooked], fixed: true };
  }
  if (x.type === "ConditionalExpression")
    return { tokens: [...tokensOf(x.consequent).tokens, ...tokensOf(x.alternate).tokens], fixed: false };
  if (x.type === "LogicalExpression")
    return { tokens: [...tokensOf(x.left).tokens, ...tokensOf(x.right).tokens], fixed: false };
  return { tokens: [], fixed: false };
}

function keyOf(p: ObjectExpression["properties"][number]): string | undefined {
  if (p.type !== "Property" || p.computed || p.kind !== "init") return undefined;
  if (p.key.type === "Identifier") return p.key.name;
  if (p.key.type === "Literal" && (typeof p.key.value === "string" || typeof p.key.value === "number"))
    return String(p.key.value);
  return undefined;
}

/** Leaves of one style prop value (token or `{ base, md, ... }`); true when every leaf is a literal. */
function responsive(prop: string, e: Expression, state: State | undefined, out: Leaf[]): boolean {
  const x = unparen(e);
  if (x.type !== "ObjectExpression") {
    const t = tokensOf(x);
    for (const token of t.tokens) out.push({ prop, token, breakpoint: undefined, state });
    return t.fixed;
  }
  let fixed = true;
  for (const p of x.properties) {
    const bp = keyOf(p);
    if (bp === undefined || p.type !== "Property") {
      fixed = false;
      continue;
    }
    const t = tokensOf(p.value);
    for (const token of t.tokens) out.push({ prop, token, breakpoint: bp === "base" ? undefined : bp, state });
    fixed &&= t.fixed;
  }
  return fixed;
}

/** Leaves of a style object (`{ p: '2', states: {...} }` or a state's nested object). */
function styleObject(e: Expression, state: State | undefined, out: Leaf[]): boolean {
  const x = unparen(e);
  if (x.type !== "ObjectExpression") return false;
  let fixed = true;
  for (const p of x.properties) {
    const k = keyOf(p);
    if (k === undefined || p.type !== "Property") {
      fixed = false;
      continue;
    }
    if (STYLE_PROPS.includes(k)) fixed = responsive(k, p.value, state, out) && fixed;
    else if (k === "states" && state === undefined) fixed = statesObject(p.value, out) && fixed;
  }
  return fixed;
}

function statesObject(e: Expression, out: Leaf[]): boolean {
  const x = unparen(e);
  if (x.type !== "ObjectExpression") return false;
  let fixed = true;
  for (const p of x.properties) {
    const k = keyOf(p);
    if (k === undefined || p.type !== "Property" || !isState(k)) {
      fixed = false;
      continue;
    }
    fixed = styleObject(p.value, k, out) && fixed;
  }
  return fixed;
}

const bpRank = (b: string | undefined): string => (b === undefined ? "" : `~${b}`);

/** Class list in ui's `classesOf` order: plain props, then states; per prop, `base` then breakpoints by name. */
function classList(leaves: readonly Leaf[]): string[] {
  const rank = (l: Leaf): [number, number, string] => [
    l.state === undefined ? -1 : STATES.indexOf(l.state),
    STYLE_PROPS.indexOf(l.prop),
    bpRank(l.breakpoint),
  ];
  return [...leaves]
    .sort((x, y) => {
      const [a1, a2, a3] = rank(x);
      const [b1, b2, b3] = rank(y);
      return a1 - b1 || a2 - b2 || (a3 < b3 ? -1 : a3 > b3 ? 1 : 0);
    })
    .map((l) => className(l.prop, l.token, l.breakpoint, l.state));
}

/**
 * Style props on `@keel/ui` base elements and in `styles({...})` calls (k.ui): every literal token per
 * (prop, breakpoint, state) becomes a usage, including literal leaves of dynamic `?:`/`&&` values so their
 * classes exist in the CSS. A base element without spreads whose class is absent or literal gets its fully
 * static style attributes rewritten into one `class` (the names ui would compute at runtime); dynamic ones stay.
 */
export function collectStyles(a: Analysis): { usages: StyleUsage[]; rewrites: Map<number, StyleRewrite> } {
  const base = new Set(uiBaseElements(a).keys());
  const stylesFns = new Set<string>();
  for (const i of a.imports) {
    if (i.source.value !== UI || i.importKind === "type") continue;
    for (const s of i.specifiers) {
      if (s.type !== "ImportSpecifier" || s.importKind === "type") continue;
      const imported = s.imported.type === "Identifier" ? s.imported.name : s.imported.value;
      if (imported === "styles") stylesFns.add(s.local.name);
    }
  }
  const leaves: Leaf[] = [];
  const rewrites = new Map<number, StyleRewrite>();
  if (base.size > 0) for (const j of a.jsx) if (j.type === "JSXElement") element(j, base, leaves, rewrites);
  if (stylesFns.size > 0)
    new Visitor({
      CallExpression: (n) => {
        const arg = n.arguments[0];
        if (n.callee.type !== "Identifier" || !stylesFns.has(n.callee.name) || arg === undefined) return;
        if (arg.type === "SpreadElement" || arg.type !== "ObjectExpression") return;
        for (const p of arg.properties) if (p.type === "Property") styleObject(p.value, undefined, leaves);
      },
    }).visit(a.program);
  const byKey = new Map<string, StyleUsage>();
  for (const l of leaves) {
    const key = JSON.stringify([l.prop, l.token, l.breakpoint ?? "", l.state ?? ""]);
    if (byKey.has(key)) continue;
    byKey.set(key, {
      props: { [l.prop]: l.token },
      ...(l.breakpoint === undefined ? {} : { breakpoint: l.breakpoint }),
      ...(l.state === undefined ? {} : { state: l.state }),
    });
  }
  const usages = [...byKey.keys()].sort().flatMap((k) => {
    const u = byKey.get(k);
    return u === undefined ? [] : [u];
  });
  return { usages, rewrites };
}

function element(el: JSXElement, base: ReadonlySet<string>, out: Leaf[], rewrites: Map<number, StyleRewrite>): void {
  const n = el.openingElement.name;
  if (n.type !== "JSXIdentifier" || !base.has(n.name)) return;
  const drop = new Set<number>();
  const fixedLeaves: Leaf[] = [];
  let rewritable = true;
  let extra: string[] = [];
  let classAttr: number | undefined;
  for (const at of el.openingElement.attributes) {
    if (at.type === "JSXSpreadAttribute") {
      rewritable = false;
      continue;
    }
    const name = attrNameOf(at.name);
    if (name === "class" || name === "className") {
      const sv = staticValueOf(at.value);
      if (sv === undefined || sv.bare) rewritable = false;
      else {
        extra = sv.text.split(/\s+/).filter((c) => c !== "");
        classAttr = at.start;
      }
      continue;
    }
    if (name !== "states" && !STYLE_PROPS.includes(name)) continue;
    const v = at.value;
    const mine: Leaf[] = [];
    let fixed = false;
    if (v !== null && v.type === "Literal") {
      if (name !== "states") {
        mine.push({ prop: name, token: v.value, breakpoint: undefined, state: undefined });
        fixed = true;
      }
    } else if (v !== null && v.type === "JSXExpressionContainer" && v.expression.type !== "JSXEmptyExpression") {
      fixed = name === "states" ? statesObject(v.expression, mine) : responsive(name, v.expression, undefined, mine);
    }
    out.push(...mine);
    if (fixed) {
      drop.add(at.start);
      fixedLeaves.push(...mine);
    }
  }
  if (!rewritable || drop.size === 0) return;
  if (classAttr !== undefined) drop.add(classAttr);
  rewrites.set(el.start, { drop, className: [...classList(fixedLeaves), ...extra].join(" ") });
}
