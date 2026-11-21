import ts from "typescript";
import type { Mapped } from "./Mapped.ts";
import { dropMember } from "./dropMember.ts";
import { placeIn } from "./placeIn.ts";

type Kind = "page" | "layout" | "API GET" | "API write";

/** The members each binding kind takes (k.contract Binding): any other member is refused. */
const ROWS: Readonly<Record<Kind, readonly string[]>> = {
  page: ["component", "loader", "guard", "layout", "errorElement", "title", "POST", "PUT", "PATCH", "DELETE"],
  layout: ["component", "loader", "guard", "layout", "errorElement"],
  "API GET": ["loader", "guard"],
  "API write": ["action", "guard"],
};
const REQUIRED: Readonly<Record<Kind, string>> = {
  page: "component",
  layout: "component",
  "API GET": "loader",
  "API write": "action",
};

const nameOf = (p: ts.ObjectLiteralElementLike): string | null =>
  p.name !== undefined && (ts.isIdentifier(p.name) || ts.isStringLiteralLike(p.name)) ? p.name.text : null;

/** Each entry id of the contract `arg` holds, with its binding kind, read from its type; `null` when unreadable. */
function kindsOf(arg: ts.Expression, checker: ts.TypeChecker): ReadonlyMap<string, Kind> | null {
  const entries = checker.getTypeAtLocation(arg).getProperty("entries");
  if (entries === undefined) return null;
  const out = new Map<string, Kind>();
  for (const p of checker.getTypeOfSymbolAtLocation(entries, arg).getProperties()) {
    const t = checker.getTypeOfSymbolAtLocation(p, arg);
    const method = t.getProperty("method");
    const get =
      method !== undefined && checker.typeToString(checker.getTypeOfSymbolAtLocation(method, arg)) === '"GET"';
    out.set(
      p.name,
      method !== undefined ? (get ? "API GET" : "API write") : t.getProperty("layout") ? "layout" : "page",
    );
  }
  return out.size === 0 ? null : out;
}

/**
 * The code of a type error at `node` on the surface of the binding argument of a `manifest(contract, binding)` call
 * (k.routes Where rules fire; `placeIn`: off it, inside an inline function or nested call, the error is E1751), by its
 * position alone, the entry kinds read from the contract's type: at or under an entry's
 * `layout` member, E1506; at or under a member the entry's kind refuses, E1510 with a fix removing it (E1515 when the
 * contract cannot be read); at a key the contract lacks, E1515 with a fix removing the entry; anywhere else in the
 * argument, the argument itself included, E1515 naming what is missing. `null` outside such an argument.
 */
export function bindingTypeError(node: ts.Node, checker: ts.TypeChecker): Mapped | null {
  const at = placeIn(node, "manifest", 1);
  const contract = at?.call.arguments[0];
  if (at === null || contract === undefined) return null;
  const kinds = kindsOf(contract, checker);
  const entry = at.entry;
  const id = entry === null ? null : nameOf(entry);
  if (entry === null || id === null) {
    const bound = new Set(at.arg.properties.map(nameOf));
    const missing = [...(kinds?.keys() ?? [])].filter((k) => !bound.has(k));
    const named = missing.length === 0 ? "every entry of its contract" : missing.slice(0, 3).join(", ");
    return ["E1515", `the binding misses ${named}; bind each contract entry`];
  }
  const kind = kinds?.get(id);
  if (kinds !== null && kind === undefined)
    return ["E1515", `${id} is no entry of the contract; remove it`, [dropMember(at.arg, entry)]];
  const member = at.member === null ? null : nameOf(at.member);
  if (member === "layout") return ["E1506", `${id}: layout names no layout id of the contract`];
  if (at.member !== null && member !== null && kind !== undefined && !ROWS[kind].includes(member)) {
    const obj = entry.initializer;
    const message = `${id}: ${kind.startsWith("API") ? "an" : "a"} ${kind} binding has no ${member}`;
    return ts.isObjectLiteralExpression(obj) ? ["E1510", message, [dropMember(obj, at.member)]] : ["E1510", message];
  }
  if (at.member !== null && member !== null) return ["E1515", `${id}: ${member} does not fit the entry it is bound at`];
  const needs = kind === undefined ? "its required member" : REQUIRED[kind];
  return ["E1515", `${id}: the binding needs ${needs}`];
}
