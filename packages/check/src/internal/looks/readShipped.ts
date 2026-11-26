import { TokenSchema, tokenGroups as groupOrder } from "@keel/ui";
import { tokenGroups } from "@keel/ui/css";
import type { Expression, ObjectExpression, Program } from "oxc-parser";
import { keyName } from "../keyName.ts";
import type { Shipped } from "./Shipped.ts";
import { withWhen } from "./withWhen.ts";

type Rec = Readonly<Record<string, unknown>>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Read `<id>Tokens.ts` as text, never running it (k.looks Shipped tokens): one `import { defineTokens } from
 * '@keel/ui'` and `export const <id>Tokens = defineTokens({ ... })`, the argument an object literal of identifier or
 * string keys and string or object literal values. The first node out of form, in source order, is the problem: a
 * top-level `base` or `schemes` key before its value is judged, then another import or statement, a spread, a type
 * assertion (`as`, `satisfies`), a computed key or value, a name without `<id>.`, a `themes` key other than `contrast` and `print`, a theme holding `when`; once in form, a look naming a token the object lacks, then `TokenSchema`.
 */
export function readShipped(program: Program, id: string): Shipped {
  const names = new Map<string, string[]>();
  const keys = new Map<string, number>();
  const themes = new Map<string, ReadonlyMap<string, readonly string[]>>();
  const file = `${id}Tokens.ts`;
  const form = (what: string): string => `${file} holds ${what}; it is one defineTokens literal`;
  let problem: { at: number; message: string } | null = null;
  // The first node out of form is the problem; reading goes on past it, so the names the file holds are all known.
  const fail = (at: number, message: string): void => {
    problem ??= { at, message };
  };
  let value: Rec = {};
  let main: ObjectExpression | undefined;
  let imported = false;
  /** An object literal of string and object literal values, as data. */
  const read = (o: ObjectExpression, onKey?: (name: string, at: number) => void): Rec => {
    const out: Record<string, unknown> = {};
    for (const p of o.properties) {
      if (p.type !== "Property") {
        fail(p.start, form("a spread"));
        continue;
      }
      const k = keyName(p);
      if (k === null || p.method || p.shorthand) {
        fail(p.start, form("a computed value"));
        continue;
      }
      onKey?.(k, p.key.start);
      out[k] = leaf(p.value);
    }
    return out;
  };
  const leaf = (e: Expression): unknown => {
    if (e.type === "Literal" && typeof e.value === "string") return e.value;
    if (e.type === "TSAsExpression" || e.type === "TSSatisfiesExpression") {
      fail(e.start, form("a type assertion"));
      return leaf(e.expression);
    }
    if (e.type === "ObjectExpression") return read(e);
    fail(e.start, form("a computed value"));
    return undefined;
  };
  /** A shipped `themes` literal: only `contrast` and `print`, each with no `when`; the names each holds per group. */
  const themesOf = (o: ObjectExpression): Rec => {
    const out: Record<string, unknown> = {};
    for (const p of o.properties) {
      if (p.type !== "Property") {
        fail(p.start, form("a spread"));
        continue;
      }
      const key = keyName(p);
      if (key === null || p.method || p.shorthand) {
        fail(p.start, form("a computed value"));
        continue;
      }
      if (key !== "contrast" && key !== "print")
        fail(p.key.start, `${id}Tokens holds themes "${key}"; only contrast and print`);
      const theme = leaf(p.value);
      out[key] = theme;
      if (!isRec(theme)) continue;
      const held = new Map<string, readonly string[]>();
      for (const [g, v] of Object.entries(theme)) {
        if (g === "when") fail(p.key.start, `${id}Tokens themes "${key}" holds when; a shipped theme has none`);
        else if (isRec(v)) held.set(g, Object.keys(v));
      }
      themes.set(key, held);
    }
    return out;
  };
  const top = (o: ObjectExpression): Rec => {
    const out: Record<string, unknown> = {};
    for (const p of o.properties) {
      if (p.type !== "Property") {
        fail(p.start, form("a spread"));
        continue;
      }
      const group = keyName(p);
      if (group === "base" || group === "schemes") {
        fail(p.key.start, `${id}Tokens holds ${group}`);
        continue;
      }
      if (group === null || p.method || p.shorthand) {
        fail(p.start, form("a computed value"));
        continue;
      }
      let v = p.value;
      if (group === "themes" && v.type === "ObjectExpression") {
        out[group] = themesOf(v);
        continue;
      }
      if (v.type === "TSAsExpression" || v.type === "TSSatisfiesExpression") {
        fail(v.start, form("a type assertion"));
        while (v.type === "TSAsExpression" || v.type === "TSSatisfiesExpression") v = v.expression;
      }
      if (v.type !== "ObjectExpression") {
        out[group] = leaf(v);
        continue;
      }
      const list: string[] = [];
      names.set(group, list);
      out[group] = read(v, (name, at) => {
        if (!name.startsWith(`${id}.`)) fail(at, `${id}Tokens names ${group} "${name}" without ${id}.`);
        list.push(name);
        keys.set(`${group}\u0000${name}`, at);
      });
    }
    return out;
  };
  for (const st of program.body) {
    if (st.type === "ImportDeclaration") {
      const only = st.specifiers.length === 1 ? st.specifiers[0] : undefined;
      const ok =
        main === undefined &&
        st.importKind !== "type" &&
        st.source.value === "@keel/ui" &&
        only?.type === "ImportSpecifier" &&
        only.imported.type === "Identifier" &&
        only.imported.name === "defineTokens" &&
        only.local.name === "defineTokens" &&
        !imported;
      if (!ok) fail(st.start, form("another import"));
      imported = true;
      continue;
    }
    const decl = st.type === "ExportNamedDeclaration" ? st.declaration : null;
    const one = decl?.type === "VariableDeclaration" && decl.kind === "const" ? decl.declarations : [];
    const d = one.length === 1 ? one[0] : undefined;
    const init = d?.init;
    const arg = init?.type === "CallExpression" && init.arguments.length === 1 ? init.arguments[0] : undefined;
    const shaped =
      main === undefined &&
      d?.id.type === "Identifier" &&
      d.id.name === `${id}Tokens` &&
      init?.type === "CallExpression" &&
      init.callee.type === "Identifier" &&
      init.callee.name === "defineTokens";
    if (!shaped) fail(st.start, form("another statement"));
    else if (arg?.type === "SpreadElement") fail(arg.start, form("a spread"));
    else if (arg?.type === "TSAsExpression" || arg?.type === "TSSatisfiesExpression") {
      fail(arg.start, form("a type assertion"));
      let inner: Expression = arg.expression;
      while (inner.type === "TSAsExpression" || inner.type === "TSSatisfiesExpression") inner = inner.expression;
      if (inner.type === "ObjectExpression") {
        main = inner;
        value = top(inner);
      }
    } else if (arg?.type !== "ObjectExpression") fail(arg?.start ?? st.start, form("a computed value"));
    else {
      main = arg;
      value = top(arg);
    }
  }
  if (main === undefined) fail(0, form("another statement"));
  else if (problem === null) {
    const missing = lookGap(value, id);
    if (missing !== null) fail(keys.get(`look\u0000${missing.look}`) ?? main.start, missing.message);
    const parsed = TokenSchema.parse(withWhen(value));
    if (!parsed.ok) {
      const path = issuePath(parsed.error.data);
      fail(nodeAt(main, path) ?? main.start, `${id}Tokens fails TokenSchema at ${path.join(".")}`);
    }
  }
  return { value, names: ordered(names), themes, keys, problem };
}

/** The groups in k.ui's order, `look` last; any other group after them as written. */
function ordered(names: ReadonlyMap<string, readonly string[]>): ReadonlyMap<string, readonly string[]> {
  const out = new Map<string, readonly string[]>();
  for (const g of [...groupOrder, "look"]) {
    const n = names.get(g);
    if (n !== undefined) out.set(g, n);
  }
  for (const [g, n] of names) if (!out.has(g)) out.set(g, n);
  return out;
}

/** The first look naming a token or breakpoint the object lacks, with its E1812 message, or null. */
function lookGap(value: Rec, id: string): { look: string; message: string } | null {
  const holds = (group: string, name: string): boolean => {
    const g = value[group];
    return isRec(g) && Object.hasOwn(g, name);
  };
  const looks = value.look;
  if (!isRec(looks)) return null;
  for (const [look, set] of Object.entries(looks)) {
    const gap = setGap(set, holds);
    if (gap !== null) return { look, message: `look "${look}" names ${gap}, not in ${id}Tokens` };
  }
  return null;
}

/** In a style set: the first `<group> "<token>"` its props or `states` name that `holds` lacks, or null. */
function setGap(set: unknown, holds: (group: string, name: string) => boolean): string | null {
  if (!isRec(set)) return null;
  for (const [prop, v] of Object.entries(set)) {
    if (prop === "states") {
      if (isRec(v))
        for (const st of Object.values(v)) {
          const gap = setGap(st, holds);
          if (gap !== null) return gap;
        }
      continue;
    }
    const groups = tokenGroups[prop];
    if (groups === undefined) continue;
    const values: (readonly [string, unknown])[] =
      typeof v === "string" ? [["base", v]] : isRec(v) ? Object.entries(v) : [];
    for (const [bp, token] of values) {
      if (bp !== "base" && !holds("breakpoint", bp)) return `breakpoint "${bp}"`;
      if (typeof token === "string" && !groups.some((g) => holds(g, token))) return `${groups[0] ?? ""} "${token}"`;
    }
  }
  return null;
}

/** The first issue's path of a `schema.invalid` error's data, as strings. */
function issuePath(data: unknown): string[] {
  const issues = isRec(data) ? data.issues : undefined;
  const first: unknown = Array.isArray(issues) ? issues[0] : undefined;
  const path: unknown = isRec(first) ? first.path : undefined;
  return Array.isArray(path) ? path.map(String) : [];
}

/** The offset of the deepest key along `path` in the literal `o`, or undefined at the first segment it lacks. */
function nodeAt(o: ObjectExpression, path: readonly string[]): number | undefined {
  let at: number | undefined;
  let obj: ObjectExpression | undefined = o;
  for (const seg of path) {
    const p: ObjectExpression["properties"][number] | undefined = obj?.properties.find(
      (x) => x.type === "Property" && keyName(x) === seg,
    );
    if (p === undefined || p.type !== "Property") return at;
    at = p.key.start;
    obj = p.value.type === "ObjectExpression" ? p.value : undefined;
  }
  return at;
}
