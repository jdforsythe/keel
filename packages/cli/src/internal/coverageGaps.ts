import type { LedgerRecord } from "@keel/testing";
import type { SourceFile } from "../types/SourceFile.ts";
import type { Diag } from "./Diag.ts";
import { makeDiag } from "./makeDiag.ts";
import { specClauses } from "./specClauses.ts";
import { specStatus } from "./specStatus.ts";

/** Statuses that claim every Conformance clause is asserted by a conformance test (spec/00-map.md status key). */
const COVERED = new Set(["conformance-covered", "frozen"]);

/**
 * E1707 (k.testing Rules, `keel ledger --diff`): a section whose status is `conformance-covered` or `frozen` but
 * whose clause `n` is rated `none` in `records`, or which has no Conformance clause the ledger can read. Only
 * sections with an item in `records` (the `--scope`) are checked, except clause-less ones when no scope is given.
 * Located at the clause's line of the section file, or line 1.
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
          see: "k.testing",
        }),
      );
    for (const c of own)
      if (rung.get(`${id}#${c.n}`) === "none")
        out.push(
          makeDiag("E1707", `section ${id} is ${status} but clause ${c.n} has no evidence`, {
            path,
            line: c.line,
            col: 1,
            see: "k.testing",
          }),
        );
  }
  return out;
}
