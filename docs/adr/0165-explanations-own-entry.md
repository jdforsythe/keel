# ADR-0165: explanations in their own entry of the checker (RFC 0143)

**Status:** proposed (for the orchestrator to accept).

**Context.** The `@keel/check` main entry is 62,109 B gzip and its budget was raised seven times in one day. The explanation table is 12,686 B gzip of it and only `explain()` reads it: `check()` and `format()` never do, and a diagnostic's `fix` is the rule's own edit. `explain()` falls back to the registry, which imports every kernel rule, so a plain move would bundle the rules a second time (40,164 B).

**Decision.**
- C1: `@keel/check/explain` (file `src/explain.ts`) exports `explain(code): string`.
- C2: `explain` stays synchronous and leaves `@keel/check`; callers change one import line.
- C3: `defineRule` registrations live in one small module both entries import; `explain` reads the table, then that module, and no kernel rule.
- C4: budget lines `@keel/check` 50kb (measured 49,561 B) and `@keel/check/explain` 13.5kb (measured 12,819 B).
- C5: rules and project passes stay in the main entry; `check()` runs them all on every call.

**Alternatives.** A re-export of `explain` from the main entry (the table stays in the main bundle). An async `explain()` loading the table with `import()` (the bundled measure inlines it, and every caller turns async for a map read). A lazily built table (the strings ship anyway). An explain entry importing the registry (40,164 B). Rules and project passes behind a second entry (14,988 B and 28,754 B gzip that every `check()` call still loads).

**Consequences.**
- The main budget line measures checker code only; a raise names checker code, and new explanation rows land on the explain line.
- `import { explain } from '@keel/check'` breaks; `@keel/cli` and the listed tests move to `@keel/check/explain`. Text, diagnostics and output are unchanged.
- The `keel` binary still loads the table on every command (RFC 0143 Known limits).
- k.explain is new and proposed; a conformance test bundles the main entry and asserts it holds no reason line or fix example.
