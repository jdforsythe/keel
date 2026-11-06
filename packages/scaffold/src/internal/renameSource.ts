import MagicString from "magic-string";
import { Visitor } from "oxc-parser";
import type { RenameSpec } from "./RenameSpec.ts";
import { callArgObject } from "./callArgObject.ts";
import { importRefs } from "./importRefs.ts";
import { keyName } from "./keyName.ts";
import { parseSource } from "./parseSource.ts";
import { propertyValue } from "./propertyValue.ts";
import { resolveImport } from "./resolveImport.ts";
import { restyleSpec } from "./restyleSpec.ts";
import { rewriteString } from "./rewriteString.ts";

type Span = { start: number; end: number };

/** Starts of the `path` literal of the renamed route's entry in a routes manifest. */
function routePathStarts(program: Parameters<typeof callArgObject>[0], id: string): Set<number> {
  const out = new Set<number>();
  const obj = callArgObject(program, "manifest");
  for (const p of obj?.properties ?? []) {
    if (p.type !== "Property" || keyName(p) !== id || p.value.type !== "ObjectExpression") continue;
    const v = propertyValue(p.value, "path");
    if (v?.type === "Literal") out.add(v.start);
  }
  return out;
}

/**
 * Apply a rename to one source file (AST-aware): relative import specifiers that name a renamed file;
 * identifiers that are bindings or references (not property names, member names, or JSX attribute names)
 * when `inScope`; string and template text via `rewriteString`. `path` is the file's current path, `next`
 * its path after the rename. Returns the source unchanged when it does not parse.
 */
export function renameSource(
  tree: ReadonlyMap<string, string>,
  path: string,
  next: string,
  src: string,
  spec: RenameSpec,
  inScope: boolean,
): string {
  const program = parseSource(path, src);
  if (program === null) return src;
  const edits = new Map<number, Span & { text: string }>();
  const put = (start: number, end: number, text: string): void => {
    if (src.slice(start, end) !== text) edits.set(start, { start, end, text });
  };
  const sources = new Set<number>();
  for (const ref of importRefs(program)) {
    sources.add(ref.start);
    if (!ref.spec.startsWith(".")) continue;
    const target = resolveImport(tree, path, ref.spec);
    const moved = target === null ? undefined : spec.paths.get(target);
    let out = ref.spec;
    if (target !== null && moved !== undefined) out = restyleSpec(ref.spec, target, next, moved);
    else if (target === null) {
      const cut = ref.spec.lastIndexOf("/") + 1;
      const last = ref.spec.slice(cut);
      const dot = last.indexOf(".");
      const stem = dot < 0 ? last : last.slice(0, dot);
      const to = spec.names.get(stem);
      if (to !== undefined) out = `${ref.spec.slice(0, cut)}${to}${dot < 0 ? "" : last.slice(dot)}`;
    }
    put(ref.start + 1, ref.end - 1, out);
  }
  const exact = spec.exactAnywhere || /(^|\/)module\.ts$/.test(path);
  const routePaths = spec.route === null ? new Set<number>() : routePathStarts(program, spec.route.id);
  const skip = new Set<number>();
  const rename = (n: { name: string; start: number; end: number }): void => {
    const to = spec.names.get(n.name);
    if (inScope && to !== undefined && !skip.has(n.start)) put(n.start, n.end, to);
  };
  const text = (start: number, end: number, raw: string, isPath: boolean): void => {
    let t = rewriteString(raw, spec, inScope, exact);
    if (isPath && spec.route !== null) {
      const { from, to } = spec.route;
      t = t
        .split("/")
        .map((seg) => (seg === from ? to : seg))
        .join("/");
    }
    put(start, end, t);
  };
  new Visitor({
    MemberExpression: (n) => {
      if (!n.computed) skip.add(n.property.start);
    },
    Property: (n) => {
      if (!n.computed && !n.shorthand) skip.add(n.key.start);
    },
    MethodDefinition: (n) => {
      if (!n.computed) skip.add(n.key.start);
    },
    PropertyDefinition: (n) => {
      if (!n.computed) skip.add(n.key.start);
    },
    TSPropertySignature: (n) => {
      if (!n.computed) skip.add(n.key.start);
    },
    TSMethodSignature: (n) => {
      if (!n.computed) skip.add(n.key.start);
    },
    TSQualifiedName: (n) => void skip.add(n.right.start),
    JSXAttribute: (n) => void skip.add(n.name.start),
    JSXMemberExpression: (n) => void skip.add(n.property.start),
    Identifier: (n) => {
      if ("name" in n) rename(n);
    },
    JSXIdentifier: (n) => rename(n),
    Literal: (n) => {
      if (typeof n.value !== "string" || sources.has(n.start)) return;
      text(n.start + 1, n.end - 1, src.slice(n.start + 1, n.end - 1), routePaths.has(n.start));
    },
    TemplateElement: (n) => {
      const start = n.start + 1;
      text(start, start + n.value.raw.length, n.value.raw, false);
    },
  }).visit(program);
  if (edits.size === 0) return src;
  const ms = new MagicString(src);
  for (const e of edits.values()) ms.overwrite(e.start, e.end, e.text);
  return ms.toString();
}
