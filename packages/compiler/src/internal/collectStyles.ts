import type { Expression, JSXElement, ObjectExpression } from "oxc-parser";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { StyleUsage } from "../types/StyleUsage.ts";
import type { Analysis } from "./Analysis.ts";
import type { FnInfo } from "./FnInfo.ts";
import type { StyleRewrite } from "./StyleRewrite.ts";
import { attrNameOf } from "./attrNameOf.ts";
import { className } from "./className.ts";
import { componentFns } from "./componentFns.ts";
import { diag } from "./diag.ts";
import { staticValueOf } from "./staticValueOf.ts";
import { uiBaseElements } from "./uiBaseElements.ts";

type State = NonNullable<StyleUsage["state"]>;
type Leaf = { prop: string; token: string; breakpoint: string | undefined; state: State | undefined };

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
  "border",
  "direction",
  "align",
  "justify",
  "wrap",
];
const STATES: readonly State[] = [
  "selected",
  "checked",
  "expanded",
  "highlighted",
  "hover",
  "focusVisible",
  "active",
  "disabled",
];

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
 * Style props on `@keel/ui` base elements and `Part` (k.ui, k.aria), and the `styles={{ <part>: { ... } }}` of any
 * other component (part styles, k.aria): every literal token per (prop, breakpoint, state) becomes a usage, including
 * literal leaves of dynamic `?:`/`&&` values so their classes exist in the CSS. A base element without spreads whose
 * class is absent or literal gets its fully static style attributes rewritten into one `class` (the names ui would
 * compute at runtime); dynamic ones stay. A `styles` value, part or spread that is not an object literal is E1823,
 * except the enclosing component's own `props.styles` or a member of it, collected where its caller writes it.
 */
export function collectStyles(a: Analysis): {
  usages: StyleUsage[];
  rewrites: Map<number, StyleRewrite>;
  diagnostics: Diagnostic[];
} {
  const base = new Set(uiBaseElements(a).keys());
  for (const i of a.imports) {
    if (i.importKind === "type" || i.source.value !== "@keel/ui/aria") continue;
    for (const s of i.specifiers) {
      if (s.type !== "ImportSpecifier" || s.importKind === "type") continue;
      const imported = s.imported.type === "Identifier" ? s.imported.name : s.imported.value;
      if (imported === "Part") base.add(s.local.name);
    }
  }
  const leaves: Leaf[] = [];
  const rewrites = new Map<number, StyleRewrite>();
  const diagnostics: Diagnostic[] = [];
  const unread = (at: number): void => {
    diagnostics.push(diag(a, "E1823", at, "styles not readable statically; write the object here", "k.aria"));
  };
  const fns = componentFns(a);
  for (const j of a.jsx)
    if (j.type === "JSXElement") {
      element(j, base, leaves, rewrites);
      parts(j, base, leaves, unread, propsName(fns, j.start));
    }
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
  return { usages, rewrites, diagnostics };
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

/** The first parameter's name of the innermost component function holding `pos`, if it is a plain identifier. */
function propsName(fns: readonly FnInfo[], pos: number): string | undefined {
  let best: FnInfo | undefined;
  for (const f of fns) if (f.start <= pos && pos < f.end && (best === undefined || f.start > best.start)) best = f;
  const p = best?.node.params[0];
  return p?.type === "Identifier" ? p.name : undefined;
}

/** True for `<props>.styles`, `<props>.styles.x`, `<props>.styles?.x`: the component's own part styles, forwarded. */
function forwards(e: Expression, props: string | undefined): boolean {
  let x = unparen(e);
  if (x.type === "ChainExpression") x = x.expression;
  let styles = false;
  while (x.type === "MemberExpression") {
    styles = !x.computed && x.property.type === "Identifier" && x.property.name === "styles";
    x = x.object;
    if (x.type === "ChainExpression") x = x.expression;
  }
  return styles && x.type === "Identifier" && x.name === props;
}

/** Part styles: each part's style object in the `styles` of a component that is not a base element (never rewritten). */
function parts(
  el: JSXElement,
  base: ReadonlySet<string>,
  out: Leaf[],
  unread: (at: number) => void,
  props: string | undefined,
): void {
  const n = el.openingElement.name;
  if (n.type !== "JSXIdentifier" || !/^[A-Z]/.test(n.name) || base.has(n.name)) return;
  for (const at of el.openingElement.attributes) {
    if (at.type === "JSXSpreadAttribute" || attrNameOf(at.name) !== "styles") continue;
    const v = at.value;
    if (v === null || v.type !== "JSXExpressionContainer" || v.expression.type === "JSXEmptyExpression") {
      unread(at.start);
      continue;
    }
    const x = unparen(v.expression);
    if (forwards(x, props)) continue;
    if (x.type !== "ObjectExpression") {
      unread(x.start);
      continue;
    }
    for (const p of x.properties) {
      if (p.type === "SpreadElement" || p.computed) {
        if (p.type !== "SpreadElement" || !forwards(p.argument, props)) unread(p.start);
        continue;
      }
      const part = unparen(p.value);
      if (forwards(part, props)) continue;
      if (part.type !== "ObjectExpression") {
        unread(part.start);
        continue;
      }
      for (const q of part.properties)
        if ((q.type === "SpreadElement" && !forwards(q.argument, props)) || (q.type === "Property" && q.computed))
          unread(q.start);
      styleObject(part, undefined, out);
    }
  }
}
