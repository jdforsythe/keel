import type { Argument, CallExpression, Expression } from "oxc-parser";
import type { SourceFile } from "../../types/SourceFile.ts";
import { followRef } from "../followRef.ts";
import { storeClasses } from "../storeClasses.ts";
import type { Maker } from "./Maker.ts";
import type { SiteRead } from "./SiteRead.ts";

type At = { readonly expr: Argument; readonly file: SourceFile };

const unwrap = (e: Expression): Expression =>
  e.type === "ParenthesizedExpression" || e.type === "TSAsExpression" || e.type === "TSSatisfiesExpression"
    ? unwrap(e.expression)
    : e;

/** The field `name` of the object literal `e`, or undefined when a spread or computed key hides it or none holds it. */
function fieldOf(e: Expression, name: string): Expression | undefined {
  if (e.type !== "ObjectExpression") return undefined;
  let found: Expression | undefined;
  for (const p of e.properties) {
    if (p.type === "SpreadElement" || p.computed) return undefined;
    const key = p.key.type === "Identifier" ? p.key.name : p.key.type === "Literal" ? String(p.key.value) : undefined;
    if (key === name) found = p.value;
  }
  return found;
}

/**
 * The expression a path's `members` reach from `node`: an object literal's field, through a top-level `const` bound to
 * one; where a step cannot be taken (a spread, a computed key, any other expression), the node reached so far.
 */
function reach(node: Argument, file: SourceFile, members: readonly string[], project: readonly SourceFile[]): At {
  let at: At = { expr: node, file };
  for (const name of members) {
    if (at.expr.type === "SpreadElement") return at;
    let e = unwrap(at.expr);
    let f = at.file;
    if (e.type === "Identifier") {
      const to = followRef(e, f, project);
      if (to === null || to === "global" || "package" in to) return at;
      e = unwrap(to.expr);
      f = to.file;
    }
    const next = fieldOf(e, name);
    if (next === undefined) return at;
    at = { expr: next, file: f };
  }
  return at;
}

/**
 * The classes a store maker's call holds (k.leave E1107): the maker's own and those at the argument paths its state
 * schema reads, with the first part not read and every such part when one is not. A path that reaches no argument
 * reads nothing; a spread argument at or before a path's index makes that path unread (at the spread, as one line of
 * source), its part the call itself, so a maker calling a maker this way is no maker.
 */
export function makerRead(
  call: CallExpression,
  file: SourceFile,
  project: readonly SourceFile[],
  maker: Maker,
): SiteRead {
  const classes = new Set(maker.classes);
  let first: string | undefined;
  const parts: { readonly part: Argument; readonly file: SourceFile }[] = [];
  for (const path of maker.paths) {
    const spread = call.arguments.slice(0, path.index + 1).find((a) => a.type === "SpreadElement");
    if (spread !== undefined) {
      first ??= file.source.slice(spread.start, spread.end).replace(/\s+/g, " ");
      parts.push({ part: call, file });
      continue;
    }
    const arg = call.arguments[path.index];
    if (arg === undefined) continue;
    const at = reach(arg, file, path.members, project);
    const read = storeClasses(at.expr, at.file, project);
    if ("parts" in read) {
      first ??= read.unread;
      parts.push(...read.parts);
    } else for (const c of read.classes) classes.add(c);
  }
  return first === undefined ? { classes } : { classes, unread: first, parts };
}
