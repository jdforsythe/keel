# ADR-0020: Endpoint rules are static source rules (RFC 0031)

**Status:** accepted
**Context.** E1651-E1653 were specified with k.services but not enforced (services PLAN D10). `check()` also crashed on a `.keel` artifact lacking `data`.
**Decision.** `@keel/check` owns E1651-E1653 as per-file source rules over `endpoints({...})` literals imported from `@keel/services`; anything not statically literal is skipped, never guessed. E1652 and E1653 carry one-hunk fixes; E1651 has none. A `.keel/*.json` without `data` is E1005 with no diff.
**Alternatives.** Type-driven detection: depends on the type pass. Runtime validation in `@keel/services`: the client would ship checks the build already does.
**Consequences.** No false positives on dynamic endpoint tables; they are simply unchecked. `@keel/services` stays free of check logic.
