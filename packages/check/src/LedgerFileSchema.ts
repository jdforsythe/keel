import { s } from "@keel/schema";
import { LEDGER_HEAD } from "./internal/LEDGER_HEAD.ts";
import { MutationClaimSchema } from "./internal/MutationClaimSchema.ts";
import { RUNG } from "./internal/RUNG.ts";

/**
 * The committed ledger file as `keel ledger` reads it (k.ledger File; `tooling/ledger/ledger.json`, or
 * `.keel/ledger.json` in an app): `version` 1, the `unsafe`, `hostElements` and `negativeTypes` counts, items per rung,
 * mutation (per project, keyed by project name, `{ score, scoreJustified, threshold, killed, survived, noCoverage, justified }` and the
 * claims), exports, spec clauses and a11y claims at one of the six rungs, and `libraries` (k.library Ledger).
 * `negativeTypes`, `rungs`, `mutation`, `clauses`, `a11y` and `libraries` may be absent and, present, hold their
 * form; other keys are kept and never read. A library's file is judged on `LEDGER_HEAD` alone (`readLibraryLedger`).
 */
export const LedgerFileSchema = s.object({
  ...LEDGER_HEAD,
  negativeTypes: s.int({ min: 0 }).optional(),
  rungs: s.record(s.int({ min: 0 })).optional(),
  mutation: s
    .object({
      projects: s.record(
        s.object({
          score: s.number().optional(),
          scoreJustified: s.number().optional(),
          threshold: s.number(),
          killed: s.int({ min: 0 }).optional(),
          survived: s.int({ min: 0 }).optional(),
          noCoverage: s.int({ min: 0 }).optional(),
          justified: s.int({ min: 0 }).optional(),
        }),
      ),
      claims: s.array(MutationClaimSchema),
    })
    .optional(),
  clauses: s.array(s.object({ item: s.string(), rung: RUNG })).optional(),
  a11y: s.array(s.object({ item: s.string(), rung: RUNG })).optional(),
  libraries: s.record(s.object({ version: s.string(), unsafe: s.int(), hostElements: s.int({ min: 0 }) })).optional(),
});
