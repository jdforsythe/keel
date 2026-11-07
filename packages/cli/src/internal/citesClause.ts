import { normClause } from "./normClause.ts";

/**
 * Whether a header block, normalised by `normClause`, quotes the spec clause `clause` (k.testing Ledger): the
 * clause in double quotes, with or without its final period. A quoted prefix of a longer clause does not cite it.
 */
export function citesClause(block: string, clause: string): boolean {
  const bare = normClause(clause).replace(/\.$/, "");
  return block.includes(`"${bare}"`) || block.includes(`"${bare}."`);
}
