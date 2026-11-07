import { isRefusedAttr, isSafeUrl } from "@keel/runtime-dom/url";
import MagicString from "magic-string";
import type { Function as FunctionNode } from "oxc-parser";
import type {
  ArrowFunctionExpression,
  Expression,
  JSXAttributeValue,
  JSXChild,
  JSXElement,
  JSXFragment,
} from "oxc-parser";
import type { Analysis } from "./Analysis.ts";
import type { BindingInfo } from "./BindingInfo.ts";
import type { Edit } from "./Edit.ts";
import type { ElementInfo } from "./ElementInfo.ts";
import type { FnInfo } from "./FnInfo.ts";
import type { Lowered } from "./Lowered.ts";
import { RAW_HTML } from "./RAW_HTML.ts";
import { RAW_TEXT_TAGS } from "./RAW_TEXT_TAGS.ts";
import type { Span } from "./Span.ts";
import type { StyleRewrite } from "./StyleRewrite.ts";
import { attrNameOf } from "./attrNameOf.ts";
import { attrOf } from "./attrOf.ts";
import { bindsTo } from "./bindsTo.ts";
import { canNest } from "./canNest.ts";
import { cleanJsxText } from "./cleanJsxText.ts";
import { componentAt } from "./componentAt.ts";
import { componentFns } from "./componentFns.ts";
import { decodeEntities } from "./decodeEntities.ts";
import { elementValued } from "./elementValued.ts";
import { endsRawText } from "./endsRawText.ts";
import { escapeHtml } from "./escapeHtml.ts";
import { exprOf } from "./exprOf.ts";
import { intrinsicOf } from "./intrinsicOf.ts";
import { isHtmlTag } from "./isHtmlTag.ts";
import { isSlotCall } from "./isSlotCall.ts";
import { literalTextOf } from "./literalTextOf.ts";
import { lowerBound } from "./lowerBound.ts";
import { patternNames } from "./patternNames.ts";
import { propsNameOf } from "./propsNameOf.ts";
import { shapeAt } from "./shapeAt.ts";
import { staticValueOf } from "./staticValueOf.ts";
import { tagNameOf } from "./tagNameOf.ts";

/** Module the generated code imports the ops from (k.runtime). */
const OPS_MODULE = "@keel/runtime-dom/ops";
/** Module the generated code imports `scope` from: one scope per component instance (k.component). */
const REACTIVE_MODULE = "@keel/reactive";
const VOID: ReadonlySet<string> = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);
/** Dynamic values of these are DOM properties, not attributes (they diverge after user input). */
const PROPS: ReadonlySet<string> = new Set(["value", "checked", "selected", "indeterminate", "muted"]);
const EVENT_ALIASES: ReadonlyMap<string, string> = new Map([["doubleclick", "dblclick"]]);
/** Any `on*` attribute (any case) on an element is an event binding (D22). */
const EVENT_ATTR = /^on[a-z]/i;
const IDENT = /^[A-Za-z_$][\w$]*$/;
/** Tags of a `resource` state (k.reactive); a `Match` over exactly these discriminates on `state`. */
const RESOURCE_STATES: ReadonlySet<string> = new Set(["loading", "error", "ready"]);
/** Member calls that read a store or signal (k.store `get`/`select`): a binding using one reads client-writable state. */
const STATE_READS: ReadonlySet<string> = new Set(["get", "select"]);

type Item =
  | { kind: "text"; html: string; plain: string }
  | { kind: "dyn"; expr: Expression }
  | { kind: "el"; node: JSXElement }
  | { kind: "flow"; node: JSXElement }
  | { kind: "node"; code: () => string };

type Template = { html: string; refs: string[]; ops: string[]; root: string; vars: Map<string, string> };

const q = (s: string): string => JSON.stringify(s);

function unparen(e: Expression): Expression {
  return e.type === "ParenthesizedExpression" ? unparen(e.expression) : e;
}

/**
 * Lower every JSX expression of one analyzed file to k.runtime ops (k.compiler Output). Static subtrees
 * become one hoisted `template(html)` per root, cloned once per render; each dynamic expression becomes
 * exactly one `text`/`attr`/`prop`/`on` binding; components are called with getter props and the enclosing
 * component's `ctx` as third argument (D27); `If`, `For`, `Match`, `Boundary` lower to
 * `cond`/`list`/`match`/`boundary` at a comment anchor. `styles` rewrites static style props of base elements
 * into `class` (D23). Every component runs in its own scope; a file exporting `uses` declares them in its
 * default-export component's scope (D26). An element with an event binding or a binding that reads client-writable
 * state, and each root element of a component calling `effect`, gets `data-k` in its template: islands (k.runtime,
 * rfc:0037). Only JSX ranges, `edits`, component parameters and bodies those need, intrinsic-only imports and
 * the generated header change; all other text is kept byte for byte.
 */
export function lowerFile(
  a: Analysis,
  elements: readonly ElementInfo[],
  initial: readonly Edit[],
  styles: ReadonlyMap<number, StyleRewrite> = new Map(),
): Lowered {
  const src = a.source;
  const edits: Edit[] = [...initial];
  let ns = "__k";
  while (src.includes(ns)) ns += "_";
  const headerImports: string[] = [];
  const fns = componentFns(a);
  /** Innermost component function around `pos`. */
  const componentFnAt = (pos: number): FnInfo | undefined => {
    let best: FnInfo | undefined;
    for (const f of fns)
      if (f.start <= pos && pos < f.end && (best === undefined || f.end - f.start < best.end - best.start)) best = f;
    return best;
  };
  const ctxNames = ctxParams(a, fns, componentFnAt, ns, edits);
  componentScopes(a, fns, ns, edits, headerImports);
  moduleScope(a, ns, edits, headerImports);
  const info = new Map(elements.map((e) => [e.start, e]));
  const templates: string[] = [];
  const bindings: BindingInfo[] = [];
  /** Element ids whose binding makes them part of an island (k.runtime): they get `data-k` in their template. */
  const bound = new Set<string>();
  const stateNames = new Set(a.reactive.map((r) => r.name));
  /** True when the innermost component function around `pos` calls `effect`: its root elements are bound. */
  const effectful = (pos: number): boolean => {
    const f = componentFnAt(pos);
    return f !== undefined && a.effects.some((e) => e.start >= f.start && e.end <= f.end);
  };
  let uid = 0;
  const tmp = (p: string): string => `${ns}${p}${uid++}`;

  const jsxEnd = new Map(a.jsx.map((j) => [j.start, j.end]));
  const els = [...elements].sort((x, y) => x.start - y.start);
  /** Innermost element containing `pos` (its id), else the file's id prefix. */
  const owner = (pos: number): string => {
    for (let i = lowerBound(els, pos + 1) - 1; i >= 0; i--) {
      const e = els[i];
      if (e !== undefined && pos < (jsxEnd.get(e.start) ?? e.start)) return e.id;
    }
    return a.idPrefix;
  };
  let editsSorted = false;
  const addEdit = (e: Edit): void => {
    edits.push(e);
    editsSorted = false;
  };

  const record = (element: string, kind: BindingInfo["kind"], name: string, s: Span): void => {
    const reads = new Set<string>();
    for (let i = lowerBound(a.idents, s.start); i < a.idents.length; i++) {
      const r = a.idents[i];
      if (r === undefined || r.start >= s.end) break;
      if (r.end <= s.end) reads.add(r.name);
    }
    const props = new Set<string>();
    const pn = propsNameOf(componentAt(a, s.start));
    if (pn !== undefined) {
      const re = new RegExp(`(?<![\\w$.])${pn.replace(/\$/g, "\\$")}\\??\\.([A-Za-z_$][\\w$]*)`, "g");
      for (const m of src.slice(s.start, s.end).matchAll(re)) if (m[1] !== undefined) props.add(m[1]);
    }
    bindings.push({ element, kind, name, reads: [...reads].sort(), props: [...props].sort() });
    if (
      kind === "on" ||
      [...reads].some((r) => stateNames.has(r)) ||
      a.members.some((m) => m.start >= s.start && m.end <= s.end && STATE_READS.has(m.name))
    )
      bound.add(element);
  };

  /** Source of [start, end) with nested JSX lowered and edits applied. */
  const rewrite = (start: number, end: number): string => {
    let out = "";
    let pos = start;
    for (const it of select(start, end)) {
      out += src.slice(pos, it.start) + it.render();
      pos = it.end;
    }
    return out + src.slice(pos, end);
  };
  const code = (e: Span): string => rewrite(e.start, e.end);

  function select(start: number, end: number): (Span & { render: () => string })[] {
    const items: (Span & { render: () => string })[] = [];
    for (let i = lowerBound(a.jsx, start); i < a.jsx.length; i++) {
      const j = a.jsx[i];
      if (j === undefined || j.start >= end) break;
      if (j.end <= end) items.push({ start: j.start, end: j.end, render: () => lowerNode(j) });
    }
    if (!editsSorted) {
      edits.sort((x, y) => x.start - y.start || x.end - y.end);
      editsSorted = true;
    }
    for (let i = lowerBound(edits, start); i < edits.length; i++) {
      const e = edits[i];
      if (e === undefined || e.start > end || (e.start === end && e.end > end)) break;
      if (e.end <= end) items.push({ start: e.start, end: e.end, render: () => e.text });
    }
    // insertions first at a position, then longer items first
    const zero = (s: Span): number => (s.start === s.end ? 0 : 1);
    items.sort((x, y) => x.start - y.start || zero(x) - zero(y) || y.end - x.end);
    const out: (Span & { render: () => string })[] = [];
    let pos = start;
    for (const it of items) {
      if (it.start < pos) continue;
      out.push(it);
      pos = it.end;
    }
    return out;
  }

  function classify(children: JSXChild[], parentTag?: string, items: Item[] = []): Item[] {
    const pushText = (html: string, plain: string): void => {
      const last = items[items.length - 1];
      if (last !== undefined && last.kind === "text") {
        last.html += html;
        last.plain += plain;
      } else items.push({ kind: "text", html, plain });
    };
    for (const c of children) {
      if (c.type === "JSXText") {
        const t = cleanJsxText(c.value);
        if (t !== "") pushText(t.replace(/</g, "&lt;"), decodeEntities(t));
      } else if (c.type === "JSXFragment") classify(c.children, parentTag, items);
      else if (c.type === "JSXSpreadChild") items.push({ kind: "dyn", expr: c.expression });
      else if (c.type === "JSXExpressionContainer") {
        if (c.expression.type === "JSXEmptyExpression") continue;
        const e = unparen(c.expression);
        if (e.type === "Literal") {
          if (typeof e.value === "string" || typeof e.value === "number")
            pushText(escapeHtml(String(e.value)), String(e.value));
        } else if (e.type === "JSXElement" || e.type === "JSXFragment")
          items.push({ kind: "node", code: () => lowerNode(e) });
        else if (isSlotCall(e)) items.push({ kind: "node", code: () => `(${code(e)}) ?? ""` });
        // rfc:0061: elements in an expression are E1403 and bind nothing (never a text binding of a node).
        else if (elementValued(a, c.expression) === null) items.push({ kind: "dyn", expr: c.expression });
      } else if (isHtmlTag(tagNameOf(c.openingElement.name))) {
        const nests = parentTag === undefined || canNest(parentTag, tagNameOf(c.openingElement.name));
        items.push(nests ? { kind: "el", node: c } : { kind: "node", code: () => lowerElementRoot(c) });
      } else if (intrinsicOf(a, c) !== undefined) items.push({ kind: "flow", node: c });
      else items.push({ kind: "node", code: () => lowerComponent(c) });
    }
    return items;
  }

  function elRef(t: Template, id: string, isRoot: boolean): string {
    if (isRoot) return t.root;
    const known = t.vars.get(id);
    if (known !== undefined) return known;
    const v = tmp("e");
    t.vars.set(id, v);
    const sel = `[id="${id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
    t.refs.push(`const ${v} = ${t.root}.querySelector(${q(sel)});`);
    return v;
  }

  function attrValueCode(v: JSXAttributeValue | null): string | undefined {
    if (v === null || v.type === "Literal") return undefined;
    if (v.type === "JSXExpressionContainer")
      return v.expression.type === "JSXEmptyExpression" ? undefined : code(v.expression);
    return lowerNode(v);
  }

  function emitElement(el: JSXElement, t: Template, isRoot: boolean, inForeign = false): void {
    const me = info.get(el.start);
    const id = me?.id ?? `${a.idPrefix}.?`;
    const tag = tagNameOf(el.openingElement.name);
    const foreign = inForeign || tag === "svg" || tag === "math";
    // rfc:0058: `script`/`style` text is code or CSS. Only literal attributes and text are emitted; anything
    // bound is E1002 (`ruleRawText`) and never lowered to an op.
    const rawText = RAW_TEXT_TAGS.has(tag);
    const ref = (): string => elRef(t, id, isRoot);
    t.html += `<${tag}`;
    if (me === undefined || !me.explicit) t.html += ` id="${escapeHtml(id)}"`;
    const at = t.html.length;
    for (const at of el.openingElement.attributes) {
      if (rawText && (at.type === "JSXSpreadAttribute" || staticValueOf(at.value) === undefined)) continue;
      if (at.type === "JSXSpreadAttribute") {
        const s = tmp("s");
        const k = tmp("k");
        t.ops.push(
          `{ const ${s} = (${code(at.argument)}); for (const ${k} in ${s}) ${ns}.attr(${ref()}, ${k}, () => ${s}[${k}]); }`,
        );
        record(id, "attr", "...", at.argument);
        continue;
      }
      const name = attrNameOf(at.name);
      if (RAW_HTML.has(name) || name === "key") continue;
      const out = name === "className" ? "class" : name === "htmlFor" ? "for" : name;
      if (EVENT_ATTR.test(name)) {
        const handler = exprOf(at);
        if (handler === undefined) continue;
        const lower = name.slice(2).toLowerCase();
        const type = EVENT_ALIASES.get(lower) ?? lower;
        t.ops.push(`${ns}.on(${q(id)}, ${q(type)}, (${code(handler)}));`);
        record(id, "on", type, handler);
        continue;
      }
      const sv = staticValueOf(at.value);
      if (sv !== undefined) {
        if (isRefusedAttr(tag, out)) continue;
        if (sv.bare) {
          t.html += ` ${out}=""`;
          continue;
        }
        const decoded = sv.encoded ? decodeEntities(sv.text) : sv.text;
        let html = sv.encoded ? sv.text.replace(/"/g, "&quot;") : escapeHtml(sv.text);
        if (!isSafeUrl(out, decoded)) html = "about:blank";
        t.html += ` ${out}="${html}"`;
        continue;
      }
      const value = attrValueCode(at.value);
      if (value === undefined || at.value === null) continue;
      const kind = PROPS.has(out) ? "prop" : "attr";
      t.ops.push(`${ns}.${kind}(${ref()}, ${q(out)}, () => (${value}));`);
      record(id, kind, out, at.value);
    }
    t.html += ">";
    if (rawText) {
      // Literal text only; data children are dropped (E1002). In HTML it is raw template text, which no parser
      // decodes. In foreign content (SVG/MathML) a browser parses it as markup and the server keeps it raw, so it
      // is set once as text node data instead: the serializer is its one escaping owner (backlog 0168).
      const texts = el.children.map(literalTextOf);
      const text = texts.every((x) => x !== null) ? texts.join("") : "";
      if (foreign) {
        if (text !== "") t.ops.push(`${ref()}.textContent = ${q(text)};`);
      } else if (!endsRawText(tag, text)) t.html += text;
      t.html += `</${tag}>`;
    } else if (!VOID.has(tag)) {
      emitChildren(el.children, t, { id, tag, isRoot, foreign });
      t.html += `</${tag}>`;
    }
    if (me !== undefined && (bound.has(id) || (isRoot && effectful(el.start))))
      t.html = `${t.html.slice(0, at)} data-k="${escapeHtml(id)}"${t.html.slice(at)}`;
  }

  function emitChildren(
    children: JSXChild[],
    t: Template,
    parent: { id: string; tag: string; isRoot: boolean; foreign: boolean },
  ): void {
    const { id: parentId, isRoot: parentIsRoot } = parent;
    let index = 0;
    let prevText = false;
    const childRef = (i: number): string => {
      const parent = elRef(t, parentId, parentIsRoot);
      const v = tmp("n");
      t.refs.push(`const ${v} = ${parent}.childNodes[${i}];`);
      return v;
    };
    const separate = (): void => {
      if (!prevText) return;
      t.html += "<!---->";
      index++;
    };
    for (const it of classify(children, parent.tag)) {
      if (it.kind === "text") {
        separate();
        t.html += it.html;
        prevText = true;
      } else if (it.kind === "dyn") {
        separate();
        t.html += " ";
        const n = childRef(index);
        t.ops.push(`${ns}.text(${n}, () => (${code(it.expr)}));`);
        record(parentId, "text", "#text", it.expr);
        prevText = true;
      } else if (it.kind === "el") {
        emitElement(it.node, t, false, parent.foreign);
        prevText = false;
      } else {
        t.html += "<!---->";
        const n = childRef(index);
        t.ops.push(it.kind === "flow" ? `${lowerFlow(it.node, n)};` : `${n}.replaceWith(${it.code()});`);
        prevText = false;
      }
      index++;
    }
  }

  function lowerElementRoot(el: JSXElement): string {
    const t: Template = { html: "", refs: [], ops: [], root: tmp("r"), vars: new Map() };
    emitElement(el, t, true);
    const name = `${ns}t${templates.length}`;
    templates.push(t.html);
    const cloned = `${ns}.clone(${name})`;
    if (t.refs.length === 0 && t.ops.length === 0) return cloned;
    return `(() => { const ${t.root} = ${cloned}; ${[...t.refs, ...t.ops].join(" ")} return ${t.root}; })()`;
  }

  /**
   * Row and case callbacks are written with plain values (`(item, i) => item.name`); the ops pass
   * accessors so a row tracks its current item. A read that resolves to an identifier parameter becomes
   * a call (`item` -> `item()`), scope-aware (an inner function redeclaring the name is left alone). A
   * destructured parameter becomes an accessor `x`, and each read of a name it binds re-destructures the
   * current value through a trailing default parameter `p = (<pattern>) => ({ names })`: `p(x()).name`.
   */
  function accessorFn(fn: ArrowFunctionExpression | FunctionNode): string {
    const body = fn.body;
    if (body === null) return code(fn);
    const scope = { start: fn.start, end: fn.end };
    const ps = fn.params.slice(0, 2);
    const rewriteReads = (name: string, text: string): void => {
      for (const r of a.identsByName.get(name) ?? []) {
        if (r.start < body.start || r.end > body.end || !bindsTo(a, name, r.start, scope)) continue;
        addEdit({ start: r.start, end: r.end, text: r.shorthand ? `${name}: ${text}` : text });
      }
    };
    const extra: string[] = [];
    for (const p of ps) {
      if (p.type === "Identifier") {
        rewriteReads(p.name, `${p.name}()`);
        continue;
      }
      if (p.type === "TSParameterProperty") continue;
      const acc = tmp("x");
      const pick = tmp("p");
      const names = patternNames(p);
      addEdit({ start: p.start, end: p.end, text: acc });
      extra.push(`${pick} = (${src.slice(p.start, p.end)}) => ({ ${names.join(", ")} })`);
      for (const n of names) rewriteReads(n, `${pick}(${acc}()).${n}`);
    }
    const last = ps[ps.length - 1];
    if (extra.length > 0 && last !== undefined) {
      const pad = ps.length < 2 ? `${tmp("u")}, ` : "";
      addEdit({ start: last.end, end: last.end, text: `, ${pad}${extra.join(", ")}` });
    }
    return code(fn);
  }

  /** A function returning the node(s) for children: the callback itself when the only child is one. */
  function renderFn(children: JSXChild[]): string {
    const real = children.filter((c) => c.type !== "JSXText" || cleanJsxText(c.value) !== "");
    const only = real[0];
    if (real.length === 1 && only !== undefined && only.type === "JSXExpressionContainer") {
      const e = only.expression.type === "JSXEmptyExpression" ? undefined : unparen(only.expression);
      if (e !== undefined && (e.type === "ArrowFunctionExpression" || e.type === "FunctionExpression"))
        return accessorFn(e);
    }
    return `() => ${fragmentOf(children)}`;
  }

  /** Discriminant for `match`: explicit `key`, else the `Props` union's key, else `state` for resource tags, else `tag`. */
  function matchKey(el: JSXElement, tags: string[]): string {
    const explicit = staticValueOf(attrOf(el, "key")?.value ?? null);
    if (explicit !== undefined && !explicit.bare && explicit.text !== "") return explicit.text;
    const on = exprOf(attrOf(el, "on"));
    const shape = on === undefined ? undefined : shapeAt(a, on, propsNameOf(componentAt(a, el.start)));
    if (shape !== undefined && shape.kind === "union") return shape.key;
    return tags.length > 0 && tags.every((t) => RESOURCE_STATES.has(t)) ? "state" : "tag";
  }

  function lowerFlow(el: JSXElement, anchor: string): string {
    const kind = intrinsicOf(a, el);
    const attrCode = (name: string, fallback: string): string => {
      const at = attrOf(el, name);
      if (at === undefined) return fallback;
      const sv = staticValueOf(at.value);
      if (sv !== undefined) return sv.bare ? "true" : q(sv.encoded ? decodeEntities(sv.text) : sv.text);
      return attrValueCode(at.value) ?? fallback;
    };
    const tracked = { If: ["cond", "when"], For: ["list", "each"], Match: ["match", "on"] } as const;
    if (kind === "If" || kind === "For" || kind === "Match") {
      const [op, name] = tracked[kind];
      const at = attrOf(el, name);
      if (at?.value) record(owner(el.start), op, name, at.value);
    }
    switch (kind) {
      case "If": {
        const otherwise = attrOf(el, "fallback") === undefined ? "" : `, ${attrCode("fallback", "undefined")}`;
        return `${ns}.cond(${anchor}, () => (${attrCode("when", "false")}), ${renderFn(el.children)}${otherwise})`;
      }
      case "For": {
        const k = staticValueOf(attrOf(el, "key")?.value ?? null);
        const v = tmp("v");
        const key = k === undefined || k.bare ? `(${v}) => ${v}` : `(${v}) => ${v}[${q(k.text)}]`;
        const empty = attrOf(el, "empty") === undefined ? "" : `, ${attrCode("empty", "undefined")}`;
        return `${ns}.list(${anchor}, () => (${attrCode("each", "[]")}), ${key}, ${renderFn(el.children)}${empty})`;
      }
      case "Match": {
        const cases: string[] = [];
        const tags: string[] = [];
        for (const c of el.children) {
          if (c.type !== "JSXElement" || intrinsicOf(a, c) !== "Case") continue;
          const tag = staticValueOf(attrOf(c, "tag")?.value ?? null);
          if (tag === undefined || tag.bare) continue;
          const t = tag.encoded ? decodeEntities(tag.text) : tag.text;
          tags.push(t);
          cases.push(`${q(t)}: ${renderFn(c.children)}`);
        }
        const key = q(matchKey(el, tags));
        return `${ns}.match(${anchor}, () => (${attrCode("on", "undefined")}), ${key}, { ${cases.join(", ")} })`;
      }
      case "Boundary":
        return `${ns}.boundary(${anchor}, ${renderFn(el.children)}, ${attrCode("fallback", '() => document.createComment("")')})`;
      default:
        return `${anchor}.replaceWith(${fragmentOf(el.children)})`;
    }
  }

  function fragmentOf(children: JSXChild[]): string {
    const items = classify(children);
    const only = items[0];
    if (items.length === 1 && only !== undefined) {
      if (only.kind === "el") return lowerElementRoot(only.node);
      if (only.kind === "node") return only.code();
    }
    const f = tmp("f");
    const stmts: string[] = [];
    for (const it of items) {
      if (it.kind === "text") stmts.push(`${f}.append(${q(it.plain)});`);
      else if (it.kind === "dyn") {
        const n = tmp("t");
        stmts.push(
          `const ${n} = document.createTextNode(""); ${ns}.text(${n}, () => (${code(it.expr)})); ${f}.append(${n});`,
        );
        record(owner(it.expr.start), "text", "#text", it.expr);
      } else if (it.kind === "el") stmts.push(`${f}.append(${lowerElementRoot(it.node)});`);
      else if (it.kind === "node") stmts.push(`${f}.append(${it.code()});`);
      else {
        const an = tmp("a");
        stmts.push(`const ${an} = ${f}.appendChild(document.createComment("")); ${lowerFlow(it.node, an)};`);
      }
    }
    return `(() => { const ${f} = document.createDocumentFragment(); ${stmts.join(" ")} return ${f}; })()`;
  }

  function lowerComponent(el: JSXElement): string {
    const parts: string[] = [];
    const style = styles.get(el.start);
    for (const at of el.openingElement.attributes) {
      if (at.type === "JSXSpreadAttribute") {
        parts.push(`...(${code(at.argument)})`);
        continue;
      }
      if (style?.drop.has(at.start)) continue;
      const name = attrNameOf(at.name);
      const key = IDENT.test(name) ? name : q(name);
      const v = at.value;
      if (v === null) parts.push(`${key}: true`);
      else if (v.type === "Literal") parts.push(`${key}: ${q(decodeEntities(v.value))}`);
      else if (v.type === "JSXExpressionContainer") {
        if (v.expression.type === "JSXEmptyExpression") continue;
        const e = unparen(v.expression);
        if (e.type === "Literal" && !("regex" in e)) parts.push(`${key}: ${code(e)}`);
        else parts.push(`get ${key}() { return (${code(v.expression)}); }`);
      } else parts.push(`get ${key}() { return ${lowerNode(v)}; }`);
    }
    if (style !== undefined && style.className !== "") parts.push(`class: ${q(style.className)}`);
    // RFC 0008: JSX children are the default slot, delivered as a `children` thunk in props.
    const kids = classify(el.children);
    const only = kids[0];
    if (kids.length === 1 && only !== undefined && only.kind === "text") parts.push(`children: () => ${q(only.plain)}`);
    else if (kids.length > 0) parts.push(`children: () => ${fragmentOf(el.children)}`);
    const props = parts.length === 0 ? "{}" : `{ ${parts.join(", ")} }`;
    const f = componentFnAt(el.start);
    const ctx = f === undefined ? undefined : ctxNames.get(f.start);
    const tail = ctx === undefined ? "" : `, undefined, ${ctx}`;
    return `${tagNameOf(el.openingElement.name)}(${props}${tail})`;
  }

  function lowerNode(j: JSXElement | JSXFragment): string {
    if (j.type === "JSXFragment") return fragmentOf(j.children);
    if (isHtmlTag(tagNameOf(j.openingElement.name))) return lowerElementRoot(j);
    if (intrinsicOf(a, j) !== undefined) return fragmentOf([j]);
    return lowerComponent(j);
  }

  const ms = new MagicString(src);
  for (const it of select(0, src.length)) {
    if (it.start === it.end) ms.appendLeft(it.start, it.render());
    else ms.overwrite(it.start, it.end, it.render());
  }
  for (const i of a.imports) {
    if (i.source.value !== "@keel/runtime-dom" || i.specifiers.length === 0) continue;
    if (i.specifiers.every((s) => s.type === "ImportSpecifier" && a.intrinsics.has(s.local.name)))
      ms.remove(i.start, i.end);
  }
  const body = ms.toString() + attachedExports(a);
  const ops = body.includes(`${ns}.`);
  if (!ops && headerImports.length === 0) return { code: body, bindings };
  const header = [
    ...(ops ? [`import * as ${ns} from ${q(OPS_MODULE)};`] : []),
    ...new Set(headerImports),
    ...templates.map((html, i) => `const ${ns}t${i} = ${ns}.template(${q(html)});`),
  ].join("\n");
  return { code: `${header}\n${body}`, bindings };
}

/**
 * For each component function that renders a child component: the name of its `ctx` (third) parameter,
 * adding `<ns>props, <ns>slots, <ns>ctx` parameters as needed (D27). A function with a rest parameter or a
 * destructured third parameter passes no ctx.
 */
function ctxParams(
  a: Analysis,
  fns: readonly FnInfo[],
  componentFnAt: (pos: number) => FnInfo | undefined,
  ns: string,
  edits: Edit[],
): Map<number, string> {
  const out = new Map<number, string>();
  const seen = new Set<number>();
  const src = a.source;
  for (const j of a.jsx) {
    if (j.type !== "JSXElement" || isHtmlTag(tagNameOf(j.openingElement.name)) || intrinsicOf(a, j) !== undefined)
      continue;
    const f = componentFnAt(j.start);
    if (f === undefined || seen.has(f.start)) continue;
    seen.add(f.start);
    const ps = f.node.params;
    const third = ps[2];
    if (third !== undefined) {
      const id = third.type === "AssignmentPattern" ? third.left : third;
      if (id.type === "Identifier") out.set(f.start, id.name);
      continue;
    }
    if (ps.some((p) => p.type === "RestElement")) continue;
    const name = `${ns}ctx`;
    const first = ps[0];
    const last = ps[ps.length - 1];
    if (first === undefined || last === undefined) {
      const from = f.node.typeParameters?.end ?? (f.node.type === "ArrowFunctionExpression" ? f.start : f.node.id?.end);
      const open = src.indexOf("(", from ?? f.start);
      if (open < 0 || open >= f.end) continue;
      edits.push({ start: open + 1, end: open + 1, text: `${ns}props, ${ns}slots, ${name}` });
    } else if (
      ps.length === 1 &&
      f.node.type === "ArrowFunctionExpression" &&
      !src.slice(f.start, first.start).includes("(")
    ) {
      edits.push({
        start: first.start,
        end: first.end,
        text: `(${src.slice(first.start, first.end)}, ${ns}slots, ${name})`,
      });
    } else
      edits.push({ start: last.end, end: last.end, text: ps.length === 1 ? `, ${ns}slots, ${name}` : `, ${name}` });
    out.set(f.start, name);
  }
  return out;
}

/** The local name a file exports as `uses` (`export const uses = [...]` or `export { x as uses }`), if any. */
function usesExport(a: Analysis): string | undefined {
  for (const st of a.program.body) {
    if (st.type !== "ExportNamedDeclaration" || st.exportKind === "type") continue;
    const d = st.declaration;
    if (d?.type === "VariableDeclaration")
      for (const v of d.declarations) if (v.id.type === "Identifier" && v.id.name === "uses") return "uses";
    if (st.source !== null) continue;
    for (const sp of st.specifiers) {
      const exported = sp.exported.type === "Identifier" ? sp.exported.name : sp.exported.value;
      if (exported === "uses" && sp.local.type === "Identifier") return sp.local.name;
    }
  }
  return undefined;
}

/** The local name a file exports as `name` (`export const name`, `export function name`, or `export { x as name }`), if any. */
function exportedLocal(a: Analysis, name: string): string | undefined {
  for (const st of a.program.body) {
    if (st.type !== "ExportNamedDeclaration" || st.exportKind === "type") continue;
    const d = st.declaration;
    if (d?.type === "VariableDeclaration")
      for (const v of d.declarations) if (v.id.type === "Identifier" && v.id.name === name) return name;
    if (st.source !== null) continue;
    for (const sp of st.specifiers) {
      const exported = sp.exported.type === "Identifier" ? sp.exported.name : sp.exported.value;
      if (exported === name && sp.local.type === "Identifier") return sp.local.name;
    }
  }
  return undefined;
}

/**
 * A component file that exports `Props` (and/or `uses`) gets `Name.Props = Props` (and `Name.uses = uses`)
 * after its body, `Name` being the default-export component, so the test harness (`render`, `properties`)
 * finds them statically (D35). Skipped for an anonymous default export or an assignment already in the source.
 */
function attachedExports(a: Analysis): string {
  const name = defaultComponent(a)?.name;
  if (typeof name !== "string" || !IDENT.test(name)) return "";
  let out = "";
  for (const key of ["Props", "uses"]) {
    const local = exportedLocal(a, key);
    if (local !== undefined && !new RegExp(`(?<![\\w$])${name.replace(/\$/g, "\\$")}\\.${key}\\s*=[^=]`).test(a.source))
      out += `\n${name}.${key} = ${local};`;
  }
  return out === "" ? "" : `${out}\n`;
}

/** The default-export component function: declared inline, or a top-level function named by `export default X`. */
function defaultComponent(a: Analysis): FnInfo | undefined {
  for (const st of a.program.body) {
    if (st.type !== "ExportDefaultDeclaration") continue;
    const d = st.declaration;
    if (d.type === "FunctionDeclaration" || d.type === "FunctionExpression" || d.type === "ArrowFunctionExpression")
      return a.functions.find((f) => f.start === d.start);
    if (d.type !== "Identifier") return undefined;
    let best: FnInfo | undefined;
    for (const f of a.functions)
      if (f.name === d.name && (best === undefined || f.end - f.start > best.end - best.start)) best = f;
    return best;
  }
  return undefined;
}

/**
 * k.component: each component instance runs in its own `scope` (k.reactive), a child of the caller's owner and
 * disposed with it, so primitives it creates and the `props.children` thunk it renders belong to it, not to its
 * parent. When the file exports `uses`, the default-export component's scope first declares each transaction on
 * its store (`t.store.uses([t])`, k.store), so the declaration binds to this instance and never restricts its
 * parent or siblings (D26).
 */
function componentScopes(
  a: Analysis,
  fns: readonly FnInfo[],
  ns: string,
  edits: Edit[],
  headerImports: string[],
): void {
  const uses = usesExport(a);
  const main = uses === undefined ? undefined : defaultComponent(a);
  for (const f of fns) {
    const body = f.node.body;
    if (body === null) continue;
    const pre =
      uses !== undefined && main !== undefined && f.start === main.start
        ? `for (const ${ns}u of ${uses}) ${ns}u.store.uses([${ns}u]); `
        : "";
    if (body.type === "BlockStatement") {
      edits.push({ start: body.start + 1, end: body.start + 1, text: ` return ${ns}scoped(() => { ${pre}` });
      edits.push({ start: body.end - 1, end: body.end - 1, text: " }); " });
    } else {
      edits.push({
        start: body.start,
        end: body.start,
        text: `${ns}scoped(() => ${pre === "" ? "(" : `{ ${pre}return (`}`,
      });
      edits.push({ start: body.end, end: body.end, text: pre === "" ? "))" : "); })" });
    }
  }
  if (fns.some((f) => f.node.body !== null)) headerImports.push(...scopedHelper(ns));
}

/** The header lines of `<ns>scoped(f)`: run `f` in a new scope owned by the current owner (none at module level), return its value. */
function scopedHelper(ns: string): string[] {
  return [
    `import { scope as ${ns}scope } from ${JSON.stringify(REACTIVE_MODULE)};`,
    `const ${ns}scoped = (f) => { let v; ${ns}scope(() => { v = f(); }); return v; };`,
  ];
}

/** Local names bound to `imported` from `source`. */
function importedAs(a: Analysis, source: string, imported: string): Set<string> {
  const out = new Set<string>();
  for (const i of a.imports) {
    if (i.source.value !== source || i.importKind === "type") continue;
    for (const sp of i.specifiers) {
      if (sp.type !== "ImportSpecifier" || sp.importKind === "type") continue;
      const name = sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value;
      if (name === imported) out.add(sp.local.name);
    }
  }
  return out;
}

/**
 * Module-level reactive state (D30): a top-level `const x = store(...)` (k.store) or `signal`/`computed`/
 * `resource` (k.reactive) is created inside a root scope that lives as long as the module, since the runtime
 * rejects primitives outside any scope (E1203). An exported store under `modules/<id>/` without an explicit
 * id gets `{ id: "<id>.<export>" }` (k.store Ids: the compiler fills it from the export name).
 */
function moduleScope(a: Analysis, ns: string, edits: Edit[], headerImports: string[]): void {
  const stores = importedAs(a, "@keel/store", "store");
  const reactive = new Set<string>();
  for (const k of ["signal", "computed", "resource"])
    for (const n of importedAs(a, REACTIVE_MODULE, k)) reactive.add(n);
  if (stores.size === 0 && reactive.size === 0) return;
  const segs = a.path.replace(/\\/g, "/").split("/");
  const at = segs.indexOf("modules");
  const mod = at >= 0 && at < segs.length - 2 ? segs[at + 1] : undefined;
  let used = false;
  for (const st of a.program.body) {
    const exported = st.type === "ExportNamedDeclaration";
    const d = st.type === "ExportNamedDeclaration" ? st.declaration : st;
    if (d === null || d.type !== "VariableDeclaration") continue;
    for (const v of d.declarations) {
      const init = v.init;
      if (init === null || init.type !== "CallExpression" || init.callee.type !== "Identifier") continue;
      const callee = init.callee.name;
      const isStore = stores.has(callee);
      if (!isStore && !reactive.has(callee)) continue;
      used = true;
      edits.push({ start: init.start, end: init.start, text: `${ns}scoped(() => ` });
      edits.push({ start: init.end, end: init.end, text: ")" });
      if (!isStore || !exported || mod === undefined || v.id.type !== "Identifier") continue;
      const id = JSON.stringify(`${mod}.${v.id.name}`);
      const args = init.arguments;
      const second = args[1];
      const third = args[2];
      if (args.length === 2 && second !== undefined && second.type !== "SpreadElement")
        edits.push({ start: second.end, end: second.end, text: `, { id: ${id} }` });
      else if (third !== undefined && third.type === "ObjectExpression") {
        const named = third.properties.some(
          (p) => p.type !== "Property" || p.computed || p.key.type !== "Identifier" || p.key.name === "id",
        );
        if (!named) edits.push({ start: third.start + 1, end: third.start + 1, text: ` id: ${id},` });
      }
    }
  }
  if (!used) return;
  headerImports.push(...scopedHelper(ns));
}
