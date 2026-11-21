import { normClause } from "./normClause.ts";

const CODE = /(?<![\w])([a-z]\d{4})(?![\w])/g;

/**
 * The codes a conformance file's header names outside the quote of `clause` (k.ledger Ledger): `lines` are its header
 * comments, joined and normalised by `normClause` so a wrapped quote reads whole; each quote of the clause, with or
 * without its final period, is dropped; what remains gives every whole code (`E2003`), upper case. A range in the
 * header (`E2001-E2003`) names its two ends only.
 */
export function headerCodes(lines: readonly string[], clause: string): Set<string> {
  const bare = normClause(clause).replace(/\.$/, "");
  const text = normClause(lines.map((l) => l.replace(/^\/\/\s?/, "")).join(" "))
    .replaceAll(`"${bare}."`, " ")
    .replaceAll(`"${bare}"`, " ");
  return new Set([...text.matchAll(CODE)].flatMap((m) => (m[1] === undefined ? [] : [m[1].toUpperCase()])));
}
