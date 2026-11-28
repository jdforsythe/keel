# ADR-0218: justified mutation survivors in a checked-in file per package (RFC 0196)

**Status:** accepted (operator, 2026-11-22: the file's existence).

**Context.** P1 asks that every mutation survivor be killed or justified, and a justification has no home the ledger can read. Survivors move with every edit, so a record keyed by line drifts. A record nobody checks rots once the survivor is killed or the code moves.

**Decision.** `packages/<pkg>/mutation-justified.json` lists equivalent or otherwise unkillable mutants by file, mutator, original and replacement text, with a reason from `equivalent`, `unreachable`, `performance` and a one-sentence note. An entry justifies each Survived or NoCoverage mutant with those texts. The ledger records per package `killed`, `survived`, `noCoverage`, `justified`, `score` and `scoreJustified` (justified mutants left out of the count); thresholds are judged on `score` alone. E1725 is a malformed file or an entry that matches no survivor of the report on disk. `tooling/mutate-justified.mjs` checks the same until `keel ledger` does.

**Alternatives.** Line and column keys (drift); Stryker disable comments (the mutant leaves the report, the reason is free text); a section in `stryker.config.mjs` (code, not data); counting justified mutants toward the threshold (a package could pass E1713 by writing entries; not taken).

**Consequences.** A reviewed survivor is visible and audited every night; a stale entry fails instead of hiding. Scores keep their meaning, and the ledger shows how much of the gap is reviewed. Writing an entry takes reading the report's source text for the mutant, which `tooling/mutate-justified.mjs` matches exactly up to white space.
