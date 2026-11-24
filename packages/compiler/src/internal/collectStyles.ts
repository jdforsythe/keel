import type {
  BindingPattern,
  BindingRestElement,
  Expression,
  JSXElement,
  ObjectExpression,
  ParamPattern,
} from "oxc-parser";

type Pat = ParamPattern | BindingPattern | BindingRestElement;
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { StyleUsage } from "../types/StyleUsage.ts";
import type { Analysis } from "./Analysis.ts";
import type { Edit } from "./Edit.ts";
import type { FnInfo } from "./FnInfo.ts";
import type { StyleRewrite } from "./StyleRewrite.ts";
import { attrNameOf } from "./attrNameOf.ts";
import { className } from "./className.ts";
import { componentFns } from "./componentFns.ts";
import { diag } from "./diag.ts";
import { staticValueOf } from "./staticValueOf.ts";
import { uiBaseElements } from "./uiBaseElements.ts";

type State = NonNullable<StyleUsage["state"]>;
/** Names that forward the enclosing component's part styles: `props` (its `.styles`) and `styles` (itself). */
type Forward = { readonly props: ReadonlySet<string>; readonly styles: ReadonlySet<string> };
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
  "textAlign",
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

/** Base elements whose `styles` hold part styles (`field`, `label`, `error`). */
const CONTROLS: ReadonlySet<string> = new Set(["Input", "TextArea", "Select", "Checkbox"]);

const isState = (k: string): k is State => STATES.some((s) => s === k);

/** The `look` sets of `tokens.ts` as data (the build evaluates them), by name. */
type Looks = Readonly<Record<string, unknown>>;

const isObj = (x: unknown): x is Readonly<Record<string, unknown>> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

/** Leaves of a look set read as data: plain props, responsive records, and `states`. */
function dataLeaves(v: Readonly<Record<string, unknown>>, state: State | undefined, out: Leaf[]): void {
  for (const prop of STYLE_PROPS) {
    const x = v[prop];
    if (typeof x === "string") out.push({ prop, token: x, breakpoint: undefined, state });
    else if (isObj(x))
      for (const [bp, token] of Object.entries(x))
        if (typeof token === "string") out.push({ prop, token, breakpoint: bp === "base" ? undefined : bp, state });
  }
  const st = v.states;
  if (state === undefined && isObj(st))
    for (const s of STATES) {
      const nested = st[s];
      if (isObj(nested)) dataLeaves(nested, s, out);
    }
}

/** The classes look `name` adds beside `own` (`<state>:<prop>` keys the element sets itself), or undefined if unknown. */
function lookClasses(looks: Looks | undefined, name: string, own: ReadonlySet<string>): string[] | undefined {
  const set = looks?.[name];
  if (!isObj(set)) return undefined;
  const leaves: Leaf[] = [];
  dataLeaves(set, undefined, leaves);
  return classList(leaves.filter((l) => !own.has(`${l.state ?? ""}:${l.prop}`)));
}

/** The literal string of a `look` attribute or property value, if it is one. */
function lookName(e: Expression | null | undefined): string | undefined {
  if (e === null || e === undefined) return undefined;
  const x = unparen(e);
  if (x.type === "Literal" && typeof x.value === "string") return x.value;
  if (x.type === "TemplateLiteral" && x.expressions.length === 0) return x.quasis[0]?.value.cooked ?? undefined;
  return undefined;
}

/** `<state>:<prop>` for every style prop a literal `states` object names. */
function stateKeys(st: ObjectExpression): string[] {
  const out: string[] = [];
  for (const q of st.properties) {
    const s = keyOf(q);
    if (s === undefined || q.type !== "Property" || !isState(s)) continue;
    const inner = unparen(q.value);
    if (inner.type === "ObjectExpression")
      for (const r of inner.properties) {
        const rk = keyOf(r);
        if (rk !== undefined && STYLE_PROPS.includes(rk)) out.push(`${s}:${rk}`);
      }
  }
  return out;
}

/** `<state>:<prop>` for every style prop an object literal names, its `states` included. */
function ownKeys(o: ObjectExpression): Set<string> {
  const out = new Set<string>();
  for (const p of o.properties) {
    const k = keyOf(p);
    if (k === undefined || p.type !== "Property") continue;
    const v = unparen(p.value);
    if (STYLE_PROPS.includes(k)) out.add(`:${k}`);
    else if (k === "states" && v.type === "ObjectExpression") for (const s of stateKeys(v)) out.add(s);
  }
  return out;
}

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
 * except the enclosing component's own part styles forwarded (`props.styles`, a member of it, a `styles` destructured
 * from its first parameter, and `?? {...}` or `|| {...}` over one), collected where its caller writes it; a
 * lowercase helper is not a component and forwards nothing.
 */
export function collectStyles(
  a: Analysis,
  looks?: Looks,
): {
  usages: StyleUsage[];
  rewrites: Map<number, StyleRewrite>;
  edits: Edit[];
  diagnostics: Diagnostic[];
} {
  const ui = uiBaseElements(a);
  const base = new Set(ui.keys());
  const controls = new Set([...ui].filter(([, b]) => CONTROLS.has(b)).map(([local]) => local));
  for (const i of a.imports) {
    if (i.importKind === "type" || i.source.value !== "@keel/ui/aria") continue;
    for (const s of i.specifiers) {
      if (s.type !== "ImportSpecifier" || s.importKind === "type") continue;
      const imported = s.imported.type === "Identifier" ? s.imported.name : s.imported.value;
      if (imported === "Part") base.add(s.local.name);
    }
  }
  const leaves: Leaf[] = [];
  const named = new Set<string>();
  const edits: Edit[] = [];
  const rewrites = new Map<number, StyleRewrite>();
  const diagnostics: Diagnostic[] = [];
  const unread = (at: number): void => {
    diagnostics.push(diag(a, "E1823", at, "styles not readable statically; write the object here", "k.aria"));
  };
  const fns = componentFns(a);
  for (const j of a.jsx)
    if (j.type === "JSXElement") {
      element(j, base, leaves, rewrites, { looks, named });
      parts(j, base, controls, leaves, unread, forwardsAt(a, fns, j.start), { looks, named, edits });
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
  for (const look of [...named].sort()) usages.push({ props: {}, look });
  return { usages, rewrites, edits, diagnostics };
}

function element(
  el: JSXElement,
  base: ReadonlySet<string>,
  out: Leaf[],
  rewrites: Map<number, StyleRewrite>,
  look: { readonly looks: Looks | undefined; readonly named: Set<string> },
): void {
  const n = el.openingElement.name;
  if (n.type !== "JSXIdentifier" || !base.has(n.name)) return;
  const drop = new Set<number>();
  const own = new Set<string>();
  let lookAt: { start: number; name: string } | undefined;
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
    if (name === "look") {
      const v = at.value;
      const lit =
        v === null
          ? undefined
          : v.type === "Literal"
            ? lookName(v)
            : v.type === "JSXExpressionContainer" && v.expression.type !== "JSXEmptyExpression"
              ? lookName(v.expression)
              : undefined;
      if (lit !== undefined) {
        lookAt = { start: at.start, name: lit };
        look.named.add(lit);
      }
      continue;
    }
    if (name !== "states" && !STYLE_PROPS.includes(name)) continue;
    const v = at.value;
    if (name !== "states") own.add(`:${name}`);
    else if (v !== null && v.type === "JSXExpressionContainer" && v.expression.type === "ObjectExpression")
      for (const k of stateKeys(v.expression)) own.add(k);
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
  const fromLook = lookAt === undefined ? undefined : lookClasses(look.looks, lookAt.name, own);
  if (lookAt !== undefined && fromLook !== undefined) drop.add(lookAt.start);
  if (!rewritable || drop.size === 0) return;
  if (classAttr !== undefined) drop.add(classAttr);
  rewrites.set(el.start, { drop, className: [...(fromLook ?? []), ...classList(fixedLeaves), ...extra].join(" ") });
}

/** Names a pattern binds (`a`, `{ a, b: c }`, `[a]`, `a = 1`, `...a`). */
function bound(p: Pat | null, out: Set<string>): void {
  if (p === null) return;
  if (p.type === "Identifier") out.add(p.name);
  else if (p.type === "TSParameterProperty") bound(p.parameter, out);
  else if (p.type === "AssignmentPattern") bound(p.left, out);
  else if (p.type === "RestElement") bound(p.argument, out);
  else if (p.type === "ArrayPattern") for (const e of p.elements) bound(e, out);
  else for (const q of p.properties) bound(q.type === "RestElement" ? q.argument : q.value, out);
}

/** The local a `styles` key of an object pattern binds (`{ styles }`, `{ styles: s }`, `{ styles = {} }`). */
function stylesOf(p: Pat, out: Set<string>): void {
  if (p.type !== "ObjectPattern") return;
  for (const q of p.properties)
    if (q.type === "Property" && !q.computed && q.key.type === "Identifier" && q.key.name === "styles") {
      const v = q.value.type === "AssignmentPattern" ? q.value.left : q.value;
      if (v.type === "Identifier") out.add(v.name);
    }
}

/**
 * What forwards the component's own part styles at `pos`, resolved by binding: the innermost component function's
 * first parameter (`props`, whose `.styles` forwards) and a `styles` destructured from it, in the parameter or by a
 * top-level `const { styles } = props` (which forwards itself). A name an inner function rebinds is not the component's.
 * A lowercase helper is not a component, so nothing forwards in it.
 */
function forwardsAt(a: Analysis, fns: readonly FnInfo[], pos: number): Forward {
  let comp: FnInfo | undefined;
  for (const f of fns) if (f.start <= pos && pos < f.end && (comp === undefined || f.start > comp.start)) comp = f;
  const props = new Set<string>();
  const styles = new Set<string>();
  const first = comp?.node.params[0];
  if (comp === undefined || first === undefined) return { props, styles };
  const param = first.type === "TSParameterProperty" ? first.parameter : first;
  const p: Pat = param.type === "AssignmentPattern" ? param.left : param;
  if (p.type === "Identifier") props.add(p.name);
  stylesOf(p, styles);
  const body = comp.node.body;
  if (body?.type === "BlockStatement")
    for (const st of body.body)
      if (st.type === "VariableDeclaration")
        for (const d of st.declarations)
          if (d.init?.type === "Identifier" && props.has(d.init.name)) stylesOf(d.id, styles);
  // A function between the component and the element that rebinds a name shadows it.
  for (const f of a.functions) {
    if (f === comp || f.start <= comp.start || f.start > pos || pos >= f.end) continue;
    const shadow = new Set<string>();
    for (const q of f.node.params) bound(q, shadow);
    for (const n of shadow) {
      props.delete(n);
      styles.delete(n);
    }
  }
  return { props, styles };
}

/** `<props>.styles[...]` or `<styles>[...]` (plain or `?.`): the component's own part styles, forwarded. */
function forwards(e: Expression, f: Forward): boolean {
  let x = unparen(e);
  if (x.type === "ChainExpression") x = x.expression;
  let firstStyles = false;
  let depth = 0;
  while (x.type === "MemberExpression") {
    firstStyles = !x.computed && x.property.type === "Identifier" && x.property.name === "styles";
    depth++;
    x = x.object;
    if (x.type === "ChainExpression") x = x.expression;
  }
  if (x.type !== "Identifier") return false;
  return f.styles.has(x.name) || (depth > 0 && firstStyles && f.props.has(x.name));
}

/** Part styles: each part's style object in the `styles` of a component that is not a base element (never rewritten). */
function parts(
  el: JSXElement,
  base: ReadonlySet<string>,
  controls: ReadonlySet<string>,
  out: Leaf[],
  unread: (at: number) => void,
  f: Forward,
  look: { readonly looks: Looks | undefined; readonly named: Set<string>; readonly edits: Edit[] },
): void {
  const n = el.openingElement.name;
  const component = n.type === "JSXMemberExpression" || (n.type === "JSXIdentifier" && /^[A-Z]/.test(n.name));
  if (!component || (n.type === "JSXIdentifier" && base.has(n.name) && !controls.has(n.name))) return;
  /** A forwarded value, or `forwarded ?? literal` / `forwarded || literal`, whose literal `then` reads. */
  const value = (e: Expression, then: (o: ObjectExpression) => void): void => {
    const x = unparen(e);
    if (forwards(x, f)) return;
    if (x.type === "LogicalExpression" && x.operator !== "&&" && forwards(x.left, f)) value(x.right, then);
    else if (x.type !== "ObjectExpression") unread(x.start);
    else then(x);
  };
  for (const at of el.openingElement.attributes) {
    // A spread attribute is not read here: `{...props}` forwards the component's own `styles`.
    if (at.type === "JSXSpreadAttribute" || attrNameOf(at.name) !== "styles") continue;
    const v = at.value;
    if (v === null || v.type !== "JSXExpressionContainer" || v.expression.type === "JSXEmptyExpression") {
      unread(at.start);
      continue;
    }
    value(v.expression, (styles) => {
      for (const p of styles.properties) {
        if (p.type === "SpreadElement" || p.computed) {
          if (p.type !== "SpreadElement" || !forwards(p.argument, f)) unread(p.start);
          continue;
        }
        value(p.value, (part) => {
          for (const q of part.properties)
            if ((q.type === "SpreadElement" && !forwards(q.argument, f)) || (q.type === "Property" && q.computed))
              unread(q.start);
          styleObject(part, undefined, out);
          for (const q of part.properties) {
            if (q.type !== "Property" || keyOf(q) !== "look") continue;
            const name = lookName(q.value);
            if (name === undefined) continue;
            look.named.add(name);
            const classes = lookClasses(look.looks, name, ownKeys(part));
            // The look becomes the classes it adds; `classesOf` keeps a part style's atomic `class`.
            if (classes !== undefined)
              look.edits.push({ start: q.start, end: q.end, text: `class: ${JSON.stringify(classes.join(" "))}` });
          }
        });
      }
    });
  }
}
