# ADR-0238: k.check: an `unsafe/` file is app code outside its `unsafe(` calls (RFC 0216)

**Status:** accepted (orchestrator, 2026-11-24, for the operator to confirm).

**Context.** `keel check` dropped every file under `unsafe/` from app code and from E1757, so one justified `unsafe(` call exempted every line of its file from about 50 kernel codes and the stdlib rules that filter `unsafe/`. `keel review` lists the call (R1001) and a file with no call (R1058), not the other lines. k.check did not define app code.

**Decision.**
- k.check defines app code: a project's code file (not `.d.ts`), not test code, not `*.config.*`, not under `.keel/` or `node_modules/`. A file under `unsafe/` is app code but for its lifted ranges.
- A lifted range is the arrow function or function expression written as the second argument of an `unsafe(` call with a justification string, in a file under `unsafe/`, parameters, return type, comments and nested functions included. A named or called second argument, a call failing E1754 and a call outside `unsafe/` give none.
- A range lifts E1252, E1451, E1452, E1601, E1603, E1651, E1757, E1758 and E1759 only. Every other code, the stdlib's and libraries' included, reads the range.
- Outside a range, imports, types, signatures and helpers are app code. A cast, `!` or suppression goes inside the function; a type holding `any` is declared there; a signature takes `unknown` or a type parameter.
- No new code. E1757 in an `unsafe/` file reads `<kind> outside an unsafe() call; use a guard or move it into the call`; its fixes are unchanged. `keel review` is unchanged.
- The packages follow the same rule through structure-lint (S0004): the 12 type-only fixtures under `packages/*/unsafe/` wrap their directives in 14 `unsafe(` calls, and the ledger's `unsafe` count rises by 14. `packages/cli/conformance/unsafe/review-fixtures/` leaves structure-lint's scan as fixture text.

**Alternatives.**
- The file stays lifted and review lists each lifted line: a reason-less row per line, and check green on a bare `fetch`.
- A file-level justification: a second way to write a reason, uncounted by call.
- Lifting every in-app-code code in a range: a reason would stand in for seams that exist (origins, `reveal`, server-only files).
- Keeping the directory lift for packages: two rules for one word.

**Consequences.** No app, example or fixture project has an `unsafe/` file, so no app gains an error. Std-messages' E2406 and std-channels' E2601 and E2602 read `unsafe/` files. k.check and std.copy read `implemented` until their new clauses are covered.
