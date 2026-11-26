# ADR-0264: k.errors and k.reactive: `defect`, `attempt`'s `expect`, module roots (RFC 0242)

**Status:** accepted (orchestrator, 2026-11-26), for the operator to confirm.

**Context.** The stdlib on the library format is held to the app's rules, and its packages met E1451 (no `throw`), E1452 (no `catch` but `attempt`) and E1207 (no detached scope) by wrapping each site in `unsafe(`: 19 of the main line's 33 calls and 26 of `lane-std-formats`' 41. The kernel had no sanctioned way to raise a bug, no catch that hands back what was thrown, and never named the root scope a module's top level already gets.

**Decision.**
- `defect(message, code?): never` and `isDefect(x, code?)` in `@keel/schema`: the one way code held to the rules raises an unexpected failure. An `Error` named `Defect`, message `<code> <message>`, `code` non-enumerable; it goes where any throw goes, with nothing added. E1455 holds a given code to a literal `E` and four digits.
- `attempt(fn, expect)`: `expect` maps a thrown value it recognizes to a `KeelError` (the `err`); `undefined` throws the very value on; a defect never reaches `expect`.
- `try`/`finally` without `catch` is the cleanup form, no E1452.
- An `unsafe(` range lifts neither E1451 nor E1452; E1451's message names `defect`.
- A module root is a scope made while no scope runs; state kept for a module's life lives in one, entered later with `run`. E1207 is judged in every file but a kernel package's own, `unsafe(` ranges and libraries included.
- R1013 (`keel review`, medium): a `defect` on a `Result`'s `err` branch.

**Alternatives.** Leave the wrappers as `unsafe` (the count measures package count, not escapes); `invariant(cond)` beside `defect` (two ways); a second catch returning the raw value (unserializable, two catches); a required code now (ten std sections need codes first); a `moduleScope()` export or `detached` for libraries (a second way, or the escape E1207 exists to refuse).

**Consequences.** `unsafe` falls to 14 on the main line, 15 with `lane-std-formats` (its `focusLost` DOM read stays); every remaining call is a cast or a platform read. No stdlib package or library can detach a scope or throw inside `unsafe`. A third-party library raises, catches and keeps module state with public exports only. Kernel packages keep their own throws. k.errors, k.check and k.escapes read `implemented` until their new clauses are covered.
