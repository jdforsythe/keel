import { type Argument, type Expression, type ObjectExpression, Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { followValue } from "../internal/followValue.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { keyName } from "../internal/keyName.ts";
import { localNames } from "../internal/modules/localNames.ts";
import { schemaMarks } from "../internal/schemaMarks.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";
import type { SourceFile } from "../types/SourceFile.ts";

type Prop = {
  readonly name: string | null;
  readonly value: Expression;
  readonly file: SourceFile;
  readonly at: number;
};

/**
 * The properties of the object `expr` names, spreads of followed objects expanded; a package's export (a stdlib
 * route table, checked in its own package) gives none; null when one cannot be read.
 */
function propsOf(
  expr: Expression | Argument,
  file: SourceFile,
  project: readonly SourceFile[],
  depth = 0,
): Prop[] | null {
  const target = expr.type === "SpreadElement" ? expr.argument : expr;
  const at = depth > 8 ? null : followValue(target, file, project);
  if (at === "package") return [];
  if (at === null || typeof at === "string") return null;
  // `<x>.routes` of a package export (a stdlib route table) is that package's; of a project `manifest({...})`, its table.
  if (at.expr.type === "MemberExpression" && !at.expr.computed && at.expr.property.name === "routes") {
    const owner = followValue(at.expr.object, at.file, project);
    if (owner === "package") return [];
    const arg =
      owner !== null && typeof owner !== "string" && owner.expr.type === "CallExpression"
        ? owner.expr.arguments[0]
        : undefined;
    return arg === undefined || typeof owner === "string" || owner === null
      ? null
      : propsOf(arg, owner.file, project, depth + 1);
  }
  if (at.expr.type !== "ObjectExpression") return null;
  const obj: ObjectExpression = at.expr;
  const out: Prop[] = [];
  for (const p of obj.properties) {
    if (p.type === "SpreadElement") {
      const inner = propsOf(p, at.file, project, depth + 1);
      if (inner === null) return null;
      out.push(...inner);
    } else out.push({ name: p.computed ? null : keyName(p), value: p.value, file: at.file, at: p.start });
  }
  return out;
}

/**
 * E1111 (k.privacy): a `.pii()` node in the `params` or `search` schema of a `manifest(...)` entry, read through
 * consts, imports, re-exports, namespace members, spreads and schema arguments: a path or query reaches browser
 * history and proxy logs Keel cannot redact. A table, entry or schema it cannot read statically (a factory call, a
 * computed key) is reported too, since nothing shows it unmarked. No fix.
 */
export const piiInRouteUrl: RuleDef = {
  code: "E1111",
  message: (f) =>
    str(f.data, "why") === "unread"
      ? `route ${str(f.data, "part")} not readable statically; cannot show it holds no .pii()`
      : `personal data in route ${str(f.data, "part")}; a URL reaches history and logs`,
  explain: "A path or query reaches browser history and proxy logs, which no redaction reaches.",
  see: "k.privacy",
  check: ({ file, ast, project }) => {
    const names = localNames(ast, "manifest", "@keel/router");
    if (!isAppPath(file.path) || names.size === 0) return [];
    const out: Finding[] = [];
    const here = (p: Prop, fallback: number): number => (p.file.path === file.path ? p.at : fallback);
    new Visitor({
      CallExpression: (n) => {
        const arg = n.arguments[0];
        if (n.callee.type !== "Identifier" || !names.has(n.callee.name) || arg === undefined) return;
        const table = propsOf(arg, file, project);
        if (table === null) {
          out.push(findingAt(file, n.start, { part: "table", why: "unread" }));
          return;
        }
        for (const entry of table) {
          const def = entry.name === null ? null : propsOf(entry.value, entry.file, project);
          if (def === null) {
            out.push(findingAt(file, here(entry, n.start), { part: "entry", why: "unread" }));
            continue;
          }
          for (const p of def) {
            if (p.name !== "params" && p.name !== "search") continue;
            const verdict = schemaMarks(p.value, p.file, project);
            if (verdict === "clean") continue;
            const why = verdict === "marked" ? "marked" : "unread";
            out.push(findingAt(file, here(p, here(entry, n.start)), { part: p.name, why }));
          }
        }
      },
    }).visit(ast);
    return out;
  },
};
