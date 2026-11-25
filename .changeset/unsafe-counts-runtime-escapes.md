---
"@keel/check": minor
"@keel/cli": minor
"@keel/testing": minor
"@keel/std-statecharts": patch
"@keel/std-workflows": patch
"@keel/compiler": patch
---

A negative type test is a `*.test-d.ts` or `*.test-d.tsx` file under `test/` or `conformance/`: type-checked, never run, imported by no file. Its `// @ts-expect-error <description>` lines are expectations, not E1757, and `keel ledger --write` counts them as `negativeTypes` after `hostElements`, never compared. `keel review` reports no R1050 for one. E1760 reports an `unsafe(` reason under 8 words; E1761 a negative type test outside `test/` or `conformance/`, an import of one, or an `unsafe(` call in one. A ts-suppression comment (E1757, R1050) is one with a line that starts with a directive; a comment that only quotes one is none. `render` types each callback or slot prop a component takes beyond its `Props` schema, so a missing one does not compile. `@keel/std-statecharts/internal` exports `asEvents` for std.workflows.
