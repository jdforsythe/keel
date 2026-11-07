import { type Argument, type Expression, type PropertyKey, Visitor } from "oxc-parser";
import { globalRefs } from "../../globals/globalRefs.ts";
import type { Diagnostic } from "../../types/Diagnostic.ts";
import type { Analysis } from "../Analysis.ts";
import { RAW_HTML } from "../RAW_HTML.ts";
import { attrNameOf } from "../attrNameOf.ts";
import { diag } from "../diag.ts";
import { isHtmlTag } from "../isHtmlTag.ts";
import { tagNameOf } from "../tagNameOf.ts";
import { ruleRawText } from "./ruleRawText.ts";

/** Sinks as a member name or literal key (not JSX attributes: a JSX `srcdoc` is E1003). rfc:0053. */
const SINKS: ReadonlySet<string> = new Set([
  ...RAW_HTML,
  "setHTMLUnsafe",
  "createContextualFragment",
  "parseHTMLUnsafe",
  "DOMParser",
  "srcdoc",
]);
/** Global paths that are sinks wherever they are read: called, constructed, or passed on. */
const GLOBAL_SINKS: ReadonlySet<string> = new Set(["DOMParser", "document.write", "document.writeln"]);
/** Global callees whose argument 1 is a property key. */
const KEY_CALLS: ReadonlySet<string> = new Set([
  "Reflect.set",
  "Reflect.get",
  "Reflect.defineProperty",
  "Reflect.getOwnPropertyDescriptor",
  "Object.defineProperty",
  "Object.getOwnPropertyDescriptor",
]);
/** Global callees whose arguments after the target are property maps. */
const MAP_CALLS: ReadonlySet<string> = new Set(["Object.assign", "Object.defineProperties"]);

type Keyed = { readonly key: PropertyKey; readonly computed: boolean };

/**
 * E1002: raw HTML sinks and inline `on*` handler strings (code from a string). Names and keys resolve through
 * the rfc:0053 resolver (`globalRefs`, shared with `@keel/check` E1601/E1603): lexical scope, same-file aliases
 * and destructuring, `globalThis`/`window`/`self`, and constant-string keys (`'inner' + 'HTML'`, a template of
 * `const` parts). Reported: the `innerHTML` family as a JSX attribute; any of `SINKS` as a member name, a
 * constant computed key, or a destructured key; a `SINKS` key passed to `Reflect.set/get/defineProperty/
 * getOwnPropertyDescriptor` or `Object.defineProperty/getOwnPropertyDescriptor`, or as a key of an object
 * literal passed to `Object.assign/defineProperties`; `setAttribute(NS)` with a constant `srcdoc` or `on*` name;
 * `execCommand('insertHTML', ...)`; the global `DOMParser`, `document.write` and `document.writeln`, at each use
 * (an unexported alias at its uses); a literal `on*` key holding a string in a spread object literal on an HTML
 * element (rfc:0056); and `script`/`style` content (`ruleRawText`, rfc:0058). A fully dynamic key is not
 * detectable (rfc:0053): the compiler and runtime never emit these sinks.
 */
export function ruleRawHtml(a: Analysis): Diagnostic[] {
  const out: Diagnostic[] = [];
  const seen = new Set<number>();
  const g = globalRefs(a.program);
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
  /** The string a property key spells: a plain name, or a computed key that folds to a constant. */
  const keyOf = (p: Keyed): string | null => {
    const k = p.key;
    if (p.computed) return k.type === "PrivateIdentifier" ? null : g.constString(k);
    if (k.type === "Identifier") return k.name;
    return k.type === "Literal" && typeof k.value === "string" ? k.value : null;
  };
  const argKey = (x: Argument | undefined): { key: string; at: number } | null => {
    if (x === undefined || x.type === "SpreadElement") return null;
    const key = g.constString(x);
    return key === null ? null : { key, at: x.start };
  };
  const pathOf = (e: Expression): string => g.resolve(e)?.join(".") ?? "";

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

  new Visitor({
    MemberExpression: (n) => {
      if (n.computed) {
        const key = g.constString(n.property);
        if (key !== null && SINKS.has(key)) hit(key, n.property.start);
      }
      if (g.isAliasInit(n.start, n.end)) return;
      const p = pathOf(n);
      if (GLOBAL_SINKS.has(p)) hit(p, n.property.start);
    },
    ObjectPattern: (n) => {
      for (const q of n.properties) {
        if (q.type !== "Property") continue;
        const key = keyOf(q);
        if (key !== null && SINKS.has(key)) hit(key, q.key.start);
      }
    },
    CallExpression: (n) => {
      const c = n.callee;
      const member = c.type === "MemberExpression" && !c.computed ? c.property.name : "";
      const p = pathOf(c);
      if (member === "setAttribute" || member === "setAttributeNS") {
        const k = argKey(n.arguments[member === "setAttribute" ? 0 : 1]);
        if (k === null) return;
        if (k.key === "srcdoc") hit("srcdoc", k.at);
        else if (/^on[a-z]/i.test(k.key)) handler(k.key, k.at);
        return;
      }
      if (member === "execCommand" || p.endsWith(".execCommand")) {
        const k = argKey(n.arguments[0]);
        if (k !== null && k.key.toLowerCase() === "inserthtml") hit("execCommand insertHTML", k.at);
        return;
      }
      if (KEY_CALLS.has(p)) {
        const k = argKey(n.arguments[1]);
        if (k !== null && SINKS.has(k.key)) hit(k.key, k.at);
      } else if (MAP_CALLS.has(p))
        for (const x of n.arguments.slice(1)) {
          if (x.type !== "ObjectExpression") continue;
          for (const q of x.properties) {
            if (q.type !== "Property") continue;
            const key = keyOf(q);
            if (key !== null && SINKS.has(key)) hit(key, q.key.start);
          }
        }
    },
  }).visit(a.program);
  // Bare reads (`new DOMParser()`, `write(x)` after `const { write } = document`), after the members so a
  // `globalThis.DOMParser` is reported once, at its property.
  for (const r of g.refs) {
    if (g.isAliasInit(r.start, r.end)) continue;
    const p = g.resolveName(r.name, r.start)?.join(".") ?? "";
    if (GLOBAL_SINKS.has(p)) hit(p, r.start);
  }
  // rfc:0056: a spread object literal on an HTML element with a literal `on*` key holding a string. The runtime
  // `attr` drops every `on*` name, so this reports the source spelling; a key from data is not detectable.
  for (const j of a.jsx) {
    if (j.type !== "JSXElement" || !isHtmlTag(tagNameOf(j.openingElement.name))) continue;
    for (const at of j.openingElement.attributes) {
      if (at.type !== "JSXSpreadAttribute" || at.argument.type !== "ObjectExpression") continue;
      for (const p of at.argument.properties) {
        if (p.type !== "Property" || (p.value.type !== "Literal" && p.value.type !== "TemplateLiteral")) continue;
        if (p.value.type === "Literal" && typeof p.value.value !== "string") continue;
        const key = keyOf(p);
        if (key !== null && /^on/i.test(key)) handler(key, p.key.start);
      }
    }
  }
  ruleRawText(a, (at, message) => {
    if (seen.has(at)) return;
    seen.add(at);
    out.push(diag(a, "E1002", at, message, "k.compiler"));
  });
  return out;
}
