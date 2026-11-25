import type { Argument, Expression, ParamPattern, Program } from "oxc-parser";
import type { SourceFile } from "../../types/SourceFile.ts";
import type { ReadFn } from "../functionRead/ReadFn.ts";
import { bound } from "../functionRead/bound.ts";
import type { SiteRead } from "./SiteRead.ts";

/** A top-level function of a file and the names its parameters bind. */
type Top = { readonly fn: ReadFn; readonly params: ReadonlySet<string> };

const unwrap = (e: Expression): Expression =>
  e.type === "ParenthesizedExpression" || e.type === "TSAsExpression" || e.type === "TSSatisfiesExpression"
    ? unwrap(e.expression)
    : e;

const isFn = (e: Expression | null | undefined): e is ReadFn =>
  e !== null && e !== undefined && (e.type === "ArrowFunctionExpression" || e.type === "FunctionExpression");

const tops = new WeakMap<Program, readonly Top[]>();

/** The functions `program` declares at its top level, exported or not: a declaration, or a `const` bound to one. */
function topFunctions(program: Program): readonly Top[] {
  const known = tops.get(program);
  if (known !== undefined) return known;
  const out: Top[] = [];
  const add = (fn: ReadFn): void => {
    const params = new Set<string>();
    for (const p of fn.params satisfies ParamPattern[]) bound(p, params, []);
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

/** Whether `part` is a parameter of `top`, or a non-computed member of one (`spec.data`). */
function rooted(part: Argument, top: Top): boolean {
  if (part.type === "SpreadElement") return rooted(part.argument, top);
  let x = unwrap(part);
  while (x.type === "MemberExpression" && !x.computed) x = unwrap(x.object);
  return x.type === "Identifier" && top.params.has(x.name);
}

/**
 * The top-level function of `file` a site at `pos` lies in, when every part of `read` it cannot read is a parameter
 * of that function, or a member of one, in `file`: the site's state schema is its caller's (k.leave E1107).
 */
export function deferredTo(read: SiteRead, pos: number, file: SourceFile, program: Program): ReadFn | undefined {
  if (!("parts" in read) || read.parts.length === 0) return undefined;
  const top = topFunctions(program).find((t) => t.fn.start <= pos && pos < t.fn.end);
  if (top === undefined) return undefined;
  const inside = (p: Argument): boolean => p.start >= top.fn.start && p.end <= top.fn.end;
  return read.parts.every((p) => p.file === file && inside(p.part) && rooted(p.part, top)) ? top.fn : undefined;
}

