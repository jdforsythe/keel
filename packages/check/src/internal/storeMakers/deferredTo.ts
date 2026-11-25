import {
  type Argument,
  type Expression,
  type MemberExpression,
  type ParamPattern,
  type Program,
  Visitor,
} from "oxc-parser";
import type { SourceFile } from "../../types/SourceFile.ts";
import type { ReadFn } from "../functionRead/ReadFn.ts";
import { bound } from "../functionRead/bound.ts";
import type { MakerPath } from "./MakerPath.ts";
import type { SiteRead } from "./SiteRead.ts";

/** A top-level function of a file and the argument index each name its parameters bind stands for. */
type Top = { readonly fn: ReadFn; readonly params: ReadonlyMap<string, number> };

const unwrap = (e: Expression): Expression =>
  e.type === "ParenthesizedExpression" || e.type === "TSAsExpression" || e.type === "TSSatisfiesExpression"
    ? unwrap(e.expression)
    : e;

const isFn = (e: Expression | null | undefined): e is ReadFn =>
  e !== null && e !== undefined && (e.type === "ArrowFunctionExpression" || e.type === "FunctionExpression");

const tops = new WeakMap<Program, readonly Top[]>();
const parents = new WeakMap<Program, ReadonlyMap<string, MemberExpression>>();

/** Each non-computed member expression of `program` by the range of its object (`spec` of `spec.data`). */
function memberParents(program: Program): ReadonlyMap<string, MemberExpression> {
  const known = parents.get(program);
  if (known !== undefined) return known;
  const out = new Map<string, MemberExpression>();
  new Visitor({
    MemberExpression: (m) => {
      if (!m.computed) out.set(`${m.object.start}:${m.object.end}`, m);
    },
  }).visit(program);
  parents.set(program, out);
  return out;
}

/** The functions `program` declares at its top level, exported or not: a declaration, or a `const` bound to one. */
function topFunctions(program: Program): readonly Top[] {
  const known = tops.get(program);
  if (known !== undefined) return known;
  const out: Top[] = [];
  const add = (fn: ReadFn): void => {
    const params = new Map<string, number>();
    fn.params.forEach((p: ParamPattern, i) => {
      const names = new Set<string>();
      bound(p, names, []);
      for (const n of names) params.set(n, i);
    });
    out.push({ fn, params });
  };
  for (const st of program.body) {
    const d = st.type === "ExportNamedDeclaration" || st.type === "ExportDefaultDeclaration" ? st.declaration : st;
    if (d === null || d === undefined) continue;
    if ((d.type === "FunctionDeclaration" || d.type === "FunctionExpression") && d.body !== null) add(d);
    else if (d.type === "ArrowFunctionExpression") add(d);
    else if (d.type === "VariableDeclaration")
      for (const v of d.declarations) {
        const init = v.init === null || v.init === undefined ? undefined : unwrap(v.init);
        if (isFn(init)) add(init);
      }
  }
  tops.set(program, out);
  return out;
}

/**
 * The argument path `part` reads when it is a parameter of `top`, or a non-computed member of one (`spec.data`); a
 * name a destructuring parameter binds stands for its whole argument.
 */
function pathOf(part: Argument, top: Top, program: Program): MakerPath | undefined {
  if (part.type === "SpreadElement") return pathOf(part.argument, top, program);
  const members: string[] = [];
  let x = unwrap(part);
  while (x.type === "MemberExpression" && !x.computed) {
    members.unshift(x.property.name);
    x = unwrap(x.object);
  }
  if (x.type !== "Identifier") return undefined;
  const index = top.params.get(x.name);
  if (index === undefined) return undefined;
  // The read stops at the parameter; the members written after it in the source are the path (`spec` of `spec.data`).
  const up = memberParents(program);
  for (let m = up.get(`${part.start}:${part.end}`); m !== undefined; m = up.get(`${m.start}:${m.end}`))
    if (!m.computed) members.push(m.property.name);
  const plain = top.fn.params[index]?.type === "Identifier";
  return { index, members: plain ? members : [] };
}

/**
 * The top-level function of `file` a site at `pos` lies in, the argument paths it reads and the classes `read` took,
 * when every part of `read` it cannot read is a parameter of that function, or a member of one, in `file`: the site's
 * state schema is its caller's (k.leave E1107).
 */
export function deferredTo(
  read: SiteRead,
  pos: number,
  file: SourceFile,
  program: Program,
): { readonly fn: ReadFn; readonly paths: readonly MakerPath[]; readonly classes: ReadonlySet<string> } | undefined {
  if (!("parts" in read) || read.parts.length === 0) return undefined;
  const top = topFunctions(program).find((t) => t.fn.start <= pos && pos < t.fn.end);
  if (top === undefined) return undefined;
  const paths: MakerPath[] = [];
  for (const p of read.parts) {
    const inside = p.part.start >= top.fn.start && p.part.end <= top.fn.end;
    const path = p.file === file && inside ? pathOf(p.part, top, program) : undefined;
    if (path === undefined) return undefined;
    paths.push(path);
  }
  return { fn: top.fn, paths, classes: read.classes };
}
