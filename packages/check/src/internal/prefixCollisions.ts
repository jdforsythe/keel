import type { Expression, ObjectExpression, StringLiteral } from "oxc-parser";
import { Visitor } from "oxc-parser";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import type { Checked } from "./Checked.ts";
import type { SchemaSource } from "./SchemaSource.ts";
import { applyEdits } from "./applyEdits.ts";
import { clip } from "./clip.ts";
import { isAppPath } from "./isAppPath.ts";
import { keyName } from "./keyName.ts";
import { lineCol } from "./lineCol.ts";
import { joinPath } from "./modules/joinPath.ts";
import { localNames } from "./modules/localNames.ts";
import { paramsFields } from "./paramsFields.ts";
import { parseFile } from "./parseFile.ts";
import { propertyOf } from "./propertyOf.ts";
import { schemaSourceOf } from "./schemaSourceOf.ts";
import { unifiedDiff } from "./unifiedDiff.ts";

const MAX_HOPS = 8;
const SUFFIXES = ["", ".ts", ".tsx", "/index.ts"];

type Prefix = { readonly name: string; readonly values: readonly string[]; readonly d: string };
type Seg = { readonly param: boolean; readonly text: string };
type Route = {
  readonly id: string;
  readonly file: SourceFile;
  readonly at: StringLiteral;
  readonly segs: readonly Seg[];
  /** Param name -> its field's `pathDefault` enum, for fields that declare one. */
  readonly enums: ReadonlyMap<string, Prefix>;
};

const strings = (e: Expression | undefined): string[] | null => {
  if (e?.type !== "ArrayExpression") return null;
  const out: string[] = [];
  for (const x of e.elements) {
    if (x?.type !== "Literal" || typeof x.value !== "string") return null;
    out.push(x.value);
  }
  return out;
};

/** The project file a relative import specifier in `from` names. */
function target(from: string, spec: string, files: readonly SourceFile[]): SourceFile | undefined {
  if (!spec.startsWith("./") && !spec.startsWith("../")) return undefined;
  const base = joinPath(from.slice(0, Math.max(0, from.lastIndexOf("/"))), spec);
  for (const suffix of SUFFIXES) {
    const hit = files.find((f) => f.path === `${base}${suffix}`);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

/** `s.enum([...], { pathDefault: 'd' })` reached from `e` through consts and relative imports, as values and default. */
function enumOf(
  e: Expression,
  src: SchemaSource,
  files: readonly SourceFile[],
  hops: number,
): { values: string[]; d: string | undefined } | null {
  if (hops > MAX_HOPS) return null;
  if (e.type === "ParenthesizedExpression" || e.type === "TSAsExpression" || e.type === "TSSatisfiesExpression")
    return enumOf(e.expression, src, files, hops);
  if (e.type === "Identifier") {
    const init = src.consts.get(e.name);
    if (init !== undefined) return enumOf(init, src, files, hops + 1);
    const imp = src.imports.get(e.name);
    const file = imp === undefined ? undefined : target(src.path, imp.source, files);
    if (imp === undefined || file === undefined) return null;
    const parsed = parseFile(file);
    if (!parsed.ok) return null;
    const next = schemaSourceOf(file.path, parsed.program);
    const init2 = next.consts.get(imp.name);
    return init2 === undefined ? null : enumOf(init2, next, files, hops + 1);
  }
  if (e.type !== "CallExpression" || e.callee.type !== "MemberExpression" || e.callee.computed) return null;
  const { object, property } = e.callee;
  if (object.type !== "Identifier" || !src.s.has(object.name) || property.type !== "Identifier") return null;
  if (property.name !== "enum") return null;
  const first = e.arguments[0];
  const values = first === undefined || first.type === "SpreadElement" ? null : strings(first);
  if (values === null) return null;
  const opts = e.arguments[1];
  const pd = opts?.type === "ObjectExpression" ? propertyOf(opts, "pathDefault")?.value : undefined;
  return { values, d: pd?.type === "Literal" && typeof pd.value === "string" ? pd.value : undefined };
}

/** Every literal-path route of every `manifest({...})` call in app code, with its `pathDefault` param enums. */
function routesOf(files: readonly Checked[]): Route[] {
  const all = files.map((c) => c.file);
  const out: Route[] = [];
  for (const { file, parsed } of files) {
    if (!isAppPath(file.path)) continue;
    const fns = localNames(parsed.program, "manifest", "@keel/router");
    if (fns.size === 0) continue;
    const src = schemaSourceOf(file.path, parsed.program);
    new Visitor({
      CallExpression: (n) => {
        const arg = n.arguments[0];
        if (n.callee.type !== "Identifier" || !fns.has(n.callee.name) || arg?.type !== "ObjectExpression") return;
        for (const p of arg.properties) {
          const id = p.type === "Property" ? keyName(p) : null;
          if (p.type !== "Property" || id === null || p.value.type !== "ObjectExpression") continue;
          const route = routeOf(id, file, p.value, src, all);
          if (route !== null) out.push(route);
        }
      },
    }).visit(parsed.program);
  }
  return out;
}

function routeOf(
  id: string,
  file: SourceFile,
  entry: ObjectExpression,
  src: SchemaSource,
  files: readonly SourceFile[],
): Route | null {
  const v = propertyOf(entry, "path")?.value;
  if (v?.type !== "Literal" || typeof v.value !== "string" || !v.value.startsWith("/")) return null;
  const segs =
    v.value === "/"
      ? []
      : v.value
          .slice(1)
          .split("/")
          .map((t) => ({ param: t.startsWith(":"), text: t.replace(/^:/, "") }));
  const enums = new Map<string, Prefix>();
  const fields = paramsFields(entry);
  if (typeof fields !== "string")
    for (const q of fields.props) {
      const name = keyName(q);
      const e = name === null ? null : enumOf(q.value, src, files, 0);
      if (name !== null && e !== null && e.d !== undefined) enums.set(name, { name, values: e.values, d: e.d });
    }
  return { id, file, at: v, segs, enums };
}

const prefixOf = (r: Route): Prefix | null => {
  const s = r.segs[0];
  return s?.param === true ? (r.enums.get(s.text) ?? null) : null;
};
const keyOf = (segs: readonly Seg[]): string => `/${segs.map((s) => (s.param ? ":" : s.text)).join("/")}`;
const sameEnum = (a: Prefix, b: Prefix): boolean =>
  JSON.stringify([a.name, a.values, a.d]) === JSON.stringify([b.name, b.values, b.d]);

/**
 * E1509 (k.prefix Rules), over the checked files' route table: a `pathDefault` param that is not first in its path;
 * a second prefix param; beside a prefixed route, a route whose static first segment is a value of the prefix param,
 * whose first segment is another param, or whose path is a prefixed route's path without the prefix. Only literal
 * paths and statically resolvable params schemas are read. Fix (the last three): prepend `/:<p>` to the path.
 */
export function prefixCollisions(files: readonly Checked[]): Diagnostic[] {
  const routes = routesOf(files);
  const out: Diagnostic[] = [];
  const report = (r: Route, message: string, pre: Prefix | null): void => {
    const { line, col } = lineCol(r.file.source, r.at.start);
    const base: Diagnostic = {
      kind: "diag",
      code: "E1509",
      path: r.file.path,
      line,
      col,
      message: clip(message, 89),
      see: "k.prefix",
    };
    if (pre === null) {
      out.push(base);
      return;
    }
    const text =
      r.segs.length === 0
        ? `/:${pre.name}`
        : `/:${pre.name}/${r.segs.map((s) => (s.param ? `:${s.text}` : s.text)).join("/")}`;
    const after = applyEdits(r.file.source, [{ start: r.at.start + 1, end: r.at.end - 1, text }]);
    out.push({ ...base, fix: unifiedDiff(r.file.path, r.file.source, after) });
  };
  for (const r of routes)
    for (const s of r.segs.slice(1))
      if (s.param && r.enums.has(s.text))
        report(r, `${r.id}: pathDefault param :${s.text} must be first in its path`, null);
  const prefixed = routes.flatMap((r) => {
    const pre = prefixOf(r);
    return pre === null ? [] : [{ r, pre }];
  });
  const [first] = prefixed;
  if (first === undefined) return out;
  for (const { r, pre } of prefixed)
    if (!sameEnum(pre, first.pre))
      report(r, `${r.id}: a second prefix param :${pre.name} beside ${first.r.id}'s`, null);
  const pre = first.pre;
  const elided = new Map(prefixed.map(({ r }) => [keyOf(r.segs.slice(1)), r.id]));
  for (const r of routes) {
    if (prefixOf(r) !== null) continue;
    const s = r.segs[0];
    const twin = elided.get(keyOf(r.segs));
    if (s !== undefined && !s.param && pre.values.includes(s.text))
      report(r, `${r.id}: first segment "${s.text}" is a value of :${pre.name}`, pre);
    else if (s?.param === true && s.text !== pre.name)
      report(r, `${r.id}: first segment :${s.text} can be read as :${pre.name}`, pre);
    else if (twin !== undefined) report(r, `${r.id}: path is ${twin}'s path without its prefix :${pre.name}`, pre);
  }
  return out;
}
