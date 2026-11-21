import ts from "typescript";
import type { Mapped } from "./Mapped.ts";
import { dropMember } from "./dropMember.ts";
import { placeIn } from "./placeIn.ts";

/** The members each contract entry kind takes (k.contract): any other member is refused. */
const ROWS: Readonly<Record<string, readonly string[]>> = {
  page: ["path", "params", "search"],
  layout: ["layout"],
  API: ["method", "path", "output", "params", "query", "body", "errors", "timeout", "events"],
};

const nameOf = (p: ts.ObjectLiteralElementLike): string | null =>
  p.name !== undefined && (ts.isIdentifier(p.name) || ts.isStringLiteralLike(p.name)) ? p.name.text : null;

/**
 * The code of a type error at `node` on the surface of the entries argument of a `contract(id, entries)` call
 * (k.routes Where rules fire; `placeIn`), by its position alone: at a key without the module prefix, `"reported"` (the
 * k.module pass reports that E1155); at a member the entry's kind refuses (the kind its literal tells: `method` an API
 * entry, `layout` a layout, else a page), E1510 with a fix removing the member; anywhere else on the surface, E1510
 * with no fix. `null` off the surface: inside a nested call or function, the error is E1751.
 */
export function contractTypeError(node: ts.Node): Mapped | null {
  const at = placeIn(node, "contract", 1);
  if (at === null) return null;
  const first = at.call.arguments[0];
  const module = first !== undefined && ts.isStringLiteralLike(first) ? first.text : null;
  const entry = at.entry;
  const id = entry === null ? null : nameOf(entry);
  if (at.atKey && id !== null && module !== null && !id.startsWith(`${module}.`)) return "reported";
  if (entry === null || id === null || !ts.isObjectLiteralExpression(entry.initializer))
    return ["E1510", "a contract entry is of no kind; give each a page, layout or API shape"];
  const obj = entry.initializer;
  const names = obj.properties.map(nameOf);
  const kind = names.includes("method") ? "API" : names.includes("layout") ? "layout" : "page";
  const row = ROWS[kind] ?? [];
  const a = kind === "API" ? "an API" : `a ${kind}`;
  const member = at.member === null ? null : nameOf(at.member);
  if (at.member !== null && member !== null && !row.includes(member))
    return ["E1510", `${id}: ${a} entry has no ${member}`, [dropMember(obj, at.member)]];
  if (at.member !== null && member !== null) return ["E1510", `${id}: ${member} does not fit ${a} entry`];
  const needs = kind === "API" ? "method, path and output" : kind === "page" ? "a path" : "layout: true";
  return ["E1510", `${id}: ${a} entry needs ${needs}`];
}
