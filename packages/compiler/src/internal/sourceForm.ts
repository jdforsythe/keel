import { parseSync } from "oxc-parser";
import { cleanJsxText } from "./cleanJsxText.ts";
import { decodeEntities } from "./decodeEntities.ts";

type Json = null | boolean | string | number | Json[] | { [key: string]: Json };
type Node = Readonly<Record<string, unknown>>;

const isNode = (v: unknown): v is Node => typeof v === "object" && v !== null && !Array.isArray(v);
const typeOf = (v: unknown): string | undefined => (isNode(v) && typeof v.type === "string" ? v.type : undefined);
const text = (v: unknown): string => (typeof v === "string" ? v : "");

/** Position, source-text and parent fields of the parser's nodes: not part of the form. */
const SKIPPED: ReadonlySet<string> = new Set(["start", "end", "range", "loc", "parent", "raw", "directive"]);
/** Nodes that stand for parentheses; the tree already carries grouping. */
const GROUPING: ReadonlySet<string> = new Set(["ParenthesizedExpression", "TSParenthesizedType"]);
const lineEnds = (s: string): string => s.replace(/\r\n?/g, "\n");

const langOf = (path: string): "js" | "jsx" | "ts" | "tsx" =>
  /\.tsx$/.test(path)
    ? "tsx"
    : /\.ts$/.test(path)
      ? "ts"
      : /\.jsx$/.test(path)
        ? "jsx"
        : /\.[cm]?js$/.test(path)
          ? "js"
          : "tsx";

/** A name written as an identifier or a string literal (a property key, a module export name) as its string. */
function nameOf(n: unknown): string | undefined {
  const t = typeOf(n);
  if (!isNode(n)) return undefined;
  if (t === "Identifier" || t === "JSXIdentifier") return text(n.name);
  if (t === "Literal" && (typeof n.value === "string" || typeof n.value === "number")) return String(n.value);
  return undefined;
}

function literal(n: Node): Json {
  if (isNode(n.regex)) {
    return { t: "Literal", regex: text(n.regex.pattern), flags: [...text(n.regex.flags)].sort().join("") };
  }
  const v = n.value;
  if (typeof v === "bigint") return { t: "Literal", bigint: v.toString() };
  if (typeof n.bigint === "string") return { t: "Literal", bigint: n.bigint };
  if (typeof v === "number") return { t: "Literal", number: String(v) };
  if (typeof v === "string") return { t: "Literal", string: v };
  if (typeof v === "boolean") return { t: "Literal", boolean: v };
  return { t: "Literal", null: true };
}

/** The text of a child that reads as text: a JSX text, or an expression container holding one string literal. */
function childText(c: unknown): string | undefined {
  const t = typeOf(c);
  if (!isNode(c)) return undefined;
  if (t === "JSXText") return decodeEntities(cleanJsxText(typeof c.raw === "string" ? c.raw : text(c.value)));
  if (t === "JSXExpressionContainer" && isNode(c.expression) && typeOf(c.expression) === "Literal") {
    return typeof c.expression.value === "string" ? c.expression.value : undefined;
  }
  return undefined;
}

function children(list: readonly unknown[]): Json[] {
  const out: Json[] = [];
  let run = "";
  const flush = (): void => {
    if (run !== "") out.push({ t: "JSXText", value: run });
    run = "";
  };
  for (const c of list) {
    const s = childText(c);
    if (s !== undefined) {
      run += s;
    } else if (!(isNode(c) && c.type === "JSXExpressionContainer" && typeOf(c.expression) === "JSXEmptyExpression")) {
      flush();
      out.push(walk(c, false));
    }
  }
  flush();
  return out;
}

/** An import declaration's members: its bindings, or the side-effect entry when it has none. */
type Imports = { bindings: Set<string>; effects: Json[] };

function attributesOf(d: Node): string {
  const list = Array.isArray(d.attributes) ? d.attributes : [];
  const phase = typeof d.phase === "string" ? d.phase : "";
  return JSON.stringify([
    phase,
    list
      .map((a) => (isNode(a) ? [nameOf(a.key) ?? "", nameOf(a.value) ?? ""] : []))
      .sort((x, y) => (JSON.stringify(x) < JSON.stringify(y) ? -1 : 1)),
  ]);
}

function takeImport(decl: unknown, into: Imports): void {
  if (!isNode(decl)) return;
  const d = decl;
  const source = text(isNode(d.source) ? d.source.value : undefined);
  const attrs = attributesOf(d);
  const declKind = d.importKind === "type" ? "type" : "value";
  const specifiers = Array.isArray(d.specifiers) ? d.specifiers : [];
  if (specifiers.length === 0) {
    into.effects.push([source, attrs, declKind]);
    return;
  }
  for (const s of specifiers) {
    if (!isNode(s)) continue;
    const kind = declKind === "type" || s.importKind === "type" ? "type" : "value";
    const imported =
      s.type === "ImportDefaultSpecifier"
        ? "default"
        : s.type === "ImportNamespaceSpecifier"
          ? "*"
          : (nameOf(s.imported) ?? "");
    into.bindings.add(JSON.stringify([source, attrs, kind, imported, nameOf(s.local) ?? ""]));
  }
}

const isEmptyStatement = (v: unknown): boolean => typeOf(v) === "EmptyStatement";

function walkNode(n: Node, tagged: boolean): Json {
  const t = text(n.type);
  if (GROUPING.has(t)) return walk(n.expression ?? n.typeAnnotation, tagged);
  if (t === "Literal") return literal(n);
  if (t === "JSXText") return { t, value: childText(n) ?? "" };
  if (t === "JSXElement" || t === "JSXFragment") {
    const out: { [key: string]: Json } = { t };
    for (const k of Object.keys(n)) {
      if (SKIPPED.has(k) || k === "type" || n[k] === undefined) continue;
      out[k] = k === "children" && Array.isArray(n[k]) ? children(n[k]) : walk(n[k], false);
    }
    return out;
  }
  const out: { [key: string]: Json } = { t };
  const quasi = t === "TemplateLiteral" || t === "TSTemplateLiteralType";
  const raw = t === "TaggedTemplateExpression";
  for (const k of Object.keys(n)) {
    if (SKIPPED.has(k) || k === "type" || n[k] === undefined) continue;
    const v = n[k];
    if (quasi && k === "quasis" && Array.isArray(v)) {
      out[k] = v.map((q) => {
        const value = isNode(q) && isNode(q.value) ? q.value : {};
        const cooked = typeof value.cooked === "string" ? value.cooked : undefined;
        return tagged || cooked === undefined ? { raw: lineEnds(text(value.raw)) } : { cooked };
      });
    } else if (k === "key" && n.computed === false && nameOf(v) !== undefined) {
      out[k] = { t: "Key", name: nameOf(v) ?? "" };
    } else if ((k === "imported" || k === "local" || k === "exported") && nameOf(v) !== undefined && !quasi) {
      out[k] = { t: "Name", name: nameOf(v) ?? "" };
    } else if (raw && k === "quasi") {
      out[k] = walk(v, true);
    } else {
      out[k] = walk(v, false);
    }
  }
  return out;
}

function walk(v: unknown, tagged: boolean): Json {
  if (Array.isArray(v)) return v.filter((x) => !isEmptyStatement(x)).map((x) => walk(x, tagged));
  if (isNode(v)) return walkNode(v, tagged);
  if (v === null) return null;
  if (typeof v === "string" || typeof v === "boolean") return v;
  if (typeof v === "number") return String(v);
  return null;
}

/**
 * The normal form of one source file (k.compat Sources): a JSON value built from its syntax tree that drops what a
 * formatter changes (comments, whitespace, line endings, a byte order mark, parentheses, semicolons, trailing commas,
 * quote style and escapes, number spelling, regular expression flag order, key quoting, JSX text spelling and import
 * layout) and keeps the rest in source order. Import bindings are a sorted set; side-effect imports keep their order
 * among themselves (`import {} from './p.ts'` is one). `undefined` when the file does not parse. `path` picks the
 * language by its extension, as the compiler does.
 */
export function sourceForm(path: string, source: string): unknown {
  const code = source.startsWith("﻿") ? source.slice(1) : source;
  const r = parseSync(path, code, { sourceType: "module", lang: langOf(path), preserveParens: false });
  if (r.errors.length > 0) return undefined;
  const imports: Imports = { bindings: new Set(), effects: [] };
  const rest: unknown[] = [];
  for (const s of r.program.body) {
    if (s.type === "ImportDeclaration") takeImport(s, imports);
    else rest.push(s);
  }
  return {
    hashbang: walk(r.program.hashbang, false),
    imports: [...imports.bindings].sort(),
    effects: imports.effects,
    body: walk(rest, false),
  };
}
