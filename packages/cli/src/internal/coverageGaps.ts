import type { LedgerRecord } from "@keel/testing";
import type { SourceFile } from "../types/SourceFile.ts";
import type { Diag } from "./Diag.ts";
import { clauseKey } from "./clauseKey.ts";
import { makeDiag } from "./makeDiag.ts";
import { specClauses } from "./specClauses.ts";
import { specStatus } from "./specStatus.ts";

/** Statuses that claim every Conformance clause is asserted by a conformance test (the spec statuses of k.docs and the glossary). */
const COVERED = new Set(["conformance-covered", "frozen"]);

/**
 * E1707 (k.ledger Rules, `keel ledger --diff`): a section whose status is `conformance-covered` or `frozen` but
 * whose clause `<section>#<key>` is rated `none` in `records`, or which has no Conformance clause the ledger can read.
 * Only sections with an item in `records` (the `--scope`) are checked, except clause-less ones when no scope is given.
 * Located at the clause's line of the section file, or line 1, and naming the clause by position, `<section>#<n>`.
 */
export function coverageGaps(files: readonly SourceFile[], records: readonly LedgerRecord[], scope: string): Diag[] {
  const rung = new Map(records.map((r) => [r.item, r.rung]));
  const clauses = specClauses(files);
  const out: Diag[] = [];
  for (const [id, status] of specStatus(files)) {
    if (!COVERED.has(status)) continue;
    const path = files.find((f) => f.path.endsWith(`/${id}.md`))?.path;
    const own = clauses.filter((c) => c.id === id);
    if (own.length === 0 && scope === "")
      out.push(
        makeDiag("E1707", `section ${id} is ${status} but has no Conformance clause`, {
          path,
          line: 1,
          col: 1,
          see: "k.ledger",
        }),
      );
    for (const c of own)
      if (rung.get(`${id}#${clauseKey(c.text)}`) === "none")
        out.push(
          makeDiag("E1707", `section ${id} is ${status} but clause ${id}#${c.n} has no evidence`, {
            path,
            line: c.line,
            col: 1,
            see: "k.ledger",
          }),
        );
  }
  return out;
}
