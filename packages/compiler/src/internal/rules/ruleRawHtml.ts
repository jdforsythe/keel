import { type Argument, type Expression, type PropertyKey, Visitor } from "oxc-parser";
import type { Diagnostic } from "../../types/Diagnostic.ts";
import type { Analysis } from "../Analysis.ts";
import { RAW_HTML } from "../RAW_HTML.ts";
import { attrNameOf } from "../attrNameOf.ts";
import { diag } from "../diag.ts";
import { isHtmlTag } from "../isHtmlTag.ts";
import { tagNameOf } from "../tagNameOf.ts";

/** Sinks as a member name or literal key (not JSX attributes: a JSX `srcdoc` is E1003). rfc:0053. */
const SINKS: ReadonlySet<string> = new Set([
  ...RAW_HTML,
  "setHTMLUnsafe",
  "createContextualFragment",
  "parseHTMLUnsafe",
  "DOMParser",
  "srcdoc",
]);
/** `Reflect`/`Object` members whose argument 1 is a property key. */
const KEY_CALLS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["Reflect", new Set(["set", "get", "defineProperty", "getOwnPropertyDescriptor"])],
  ["Object", new Set(["defineProperty", "getOwnPropertyDescriptor"])],
]);
/** `Object` members whose arguments after the target are property maps. */
const MAP_CALLS: ReadonlySet<string> = new Set(["assign", "defineProperties"]);
const DOCUMENT_WRITES: ReadonlySet<string> = new Set(["write", "writeln"]);
const GLOBAL_OBJECTS: ReadonlySet<string> = new Set(["globalThis", "window", "self"]);

/**
 * E1002: raw HTML sinks and inline `on*` handler strings (code from a string). Reported: the `innerHTML`
 * family as a JSX attribute; any of `SINKS` as a member name, a computed literal key (string, template
 * without substitutions, or a `const` string declared once), or a destructured key; a `SINKS` key passed as
 * a literal to `Reflect.set/get/defineProperty/getOwnPropertyDescriptor` or `Object.defineProperty/
 * getOwnPropertyDescriptor`, or as a key of an object literal passed to `Object.assign/defineProperties`;
 * `setAttribute(NS)` with a literal `srcdoc` or `on*` name; the global `DOMParser`; `write`/`writeln` on the
 * global `document`. `Reflect`, `Object`, `DOMParser` and `document` count only when not declared in scope.
 * A fully dynamic key is not detectable (rfc:0053): the compiler and runtime never emit these sinks.
 */
export function ruleRawHtml(a: Analysis): Diagnostic[] {
  const out: Diagnostic[] = [];
  const seen = new Set<number>();
  const hit = (name: string, at: number): void => {
    if (seen.has(at)) return;
    seen.add(at);
    out.push(diag(a, "E1002", at, `raw HTML via ${name}; render text or elements instead`, "k.compiler"));
  };
  const handler = (name: string, at: number): void => {
    if (seen.has(at)) return;
    seen.add(at);
    out.push(diag(a, "E1002", at, `inline handler string in ${name}; pass a function`, "k.compiler"));
  };
  for (const j of a.jsx) {
    if (j.type !== "JSXElement") continue;
    for (const at of j.openingElement.attributes) {
      if (at.type !== "JSXAttribute") continue;
      const name = attrNameOf(at.name);
      const inline = /^on[a-z]/i.test(name) && (at.value === null || at.value.type === "Literal");
      if (RAW_HTML.has(name)) hit(name, at.start);
      else if (inline && isHtmlTag(tagNameOf(j.openingElement.name))) handler(name, at.start);
    }
  }
  for (const m of a.members) if (SINKS.has(m.name)) hit(m.name, m.start);

  /** Whether `name` read at `pos` is declared by the file (so not the global). */
  const local = (name: string, pos: number): boolean =>
    (a.decls.get(name) ?? []).some((s) => pos >= s.start && pos < s.end);
  const isGlobal = (e: Expression, name: string): boolean =>
    e.type === "Identifier" && e.name === name && !local(name, e.start);
  // `const k = 'innerHTML'` declared once: its value is a literal key. Collected before keys are read.
  const consts = new Map<string, string>();
  new Visitor({
    VariableDeclaration: (n) => {
      if (n.kind !== "const") return;
      for (const d of n.declarations) {
        if (d.id.type !== "Identifier" || d.init === null || (a.decls.get(d.id.name) ?? []).length !== 1) continue;
        const v = d.init.type === "Literal" || d.init.type === "TemplateLiteral" ? keyOf(d.init) : null;
        if (v !== null) consts.set(d.id.name, v);
      }
    },
  }).visit(a.program);
  /** The string a literal key spells: string literal, template without substitutions, or a single `const`. */
  function keyOf(e: PropertyKey): string | null {
    if (e.type === "Literal") return typeof e.value === "string" ? e.value : null;
    if (e.type === "TemplateLiteral") return e.expressions.length === 0 ? (e.quasis[0]?.value.cooked ?? null) : null;
    if (e.type === "Identifier") return consts.get(e.name) ?? null;
    return null;
  }
  const argKey = (x: Argument | undefined): { key: string; at: number } | null => {
    if (x === undefined || x.type === "SpreadElement") return null;
    const key = keyOf(x);
    return key === null ? null : { key, at: x.start };
  };
  /** `document`, or `globalThis`/`window`/`self` `.document`, as the global. */
  const isDocument = (e: Expression): boolean => {
    if (e.type === "Identifier") return isGlobal(e, "document");
    if (e.type !== "MemberExpression" || e.computed || e.property.type !== "Identifier") return false;
    const o = e.object;
    return (
      e.property.name === "document" && o.type === "Identifier" && GLOBAL_OBJECTS.has(o.name) && !local(o.name, o.start)
    );
  };

  new Visitor({
    MemberExpression: (n) => {
      const key = n.computed ? keyOf(n.property) : n.property.type === "Identifier" ? n.property.name : null;
      if (key === null) return;
      if (n.computed && SINKS.has(key)) hit(key, n.property.start);
      else if (DOCUMENT_WRITES.has(key) && isDocument(n.object)) hit(`document.${key}`, n.property.start);
    },
    ObjectPattern: (n) => {
      for (const q of n.properties) {
        if (q.type !== "Property") continue;
        const key = q.computed ? keyOf(q.key) : q.key.type === "Identifier" ? q.key.name : null;
        if (key !== null && SINKS.has(key)) hit(key, q.key.start);
      }
    },
    CallExpression: (n) => {
      const c = n.callee;
      if (c.type !== "MemberExpression" || c.computed || c.property.type !== "Identifier") return;
      const member = c.property.name;
      if (member === "setAttribute" || member === "setAttributeNS") {
        const k = argKey(n.arguments[member === "setAttribute" ? 0 : 1]);
        if (k === null) return;
        if (k.key === "srcdoc") hit("srcdoc", k.at);
        else if (/^on[a-z]/i.test(k.key)) handler(k.key, k.at);
        return;
      }
      const root = c.object.type === "Identifier" ? c.object.name : "";
      if (!isGlobal(c.object, root)) return;
      if (KEY_CALLS.get(root)?.has(member) === true) {
        const k = argKey(n.arguments[1]);
        if (k !== null && SINKS.has(k.key)) hit(k.key, k.at);
      } else if (root === "Object" && MAP_CALLS.has(member))
        for (const x of n.arguments.slice(1)) {
          if (x.type !== "ObjectExpression") continue;
          for (const p of x.properties) {
            if (p.type !== "Property") continue;
            const key = p.computed ? keyOf(p.key) : p.key.type === "Identifier" ? p.key.name : keyOf(p.key);
            if (key !== null && SINKS.has(key)) hit(key, p.key.start);
          }
        }
    },
    Identifier: (n) => {
      if (n.name === "DOMParser" && a.idents.some((r) => r.start === n.start) && !local(n.name, n.start))
        hit("DOMParser", n.start);
    },
  }).visit(a.program);
  return out;
}
