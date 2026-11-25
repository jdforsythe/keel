# ADR-0242: k.ctx: an `import()` in app code is W1608 (RFC 0220)

**Status:** accepted (orchestrator, 2026-11-24).

**Context.** A module load started by `import()` is I/O no ctx owns. A `simulate` run (k.sim) neither waits for it nor orders it by seed, so one seed can give two traces. `keel check` reports every other ambient effect (E1601) and not this one. The operator chose a warning (D137).

**Decision.**
- W1608, a warning at `import`, no fix: an `import()` expression in app code (k.check App code), whatever its specifier and however its result is used.
- Not reported: an `import()` that is E1603; a `Host`'s `code` written as its prop value in E1824's form (the harness never runs it); a message set's `load`, the arrow function written as the third argument of the `messages` import of `@keel/std-messages` (E2401 fixes its form; a loader the run waits for awaits it).
- Test code is not app code: the harness's `routes: () => import(path)` (k.testing), the one `routes` loader, is not judged.
- W1608 is not reported inside a lifted range, as E1601 and E1603 are not.
- A W code never fails `keel check`; no strict switch is added.

**Alternatives.**
- An error: the operator chose a warning.
- Judging tests, exempting literal specifiers, or reporting the two required loader forms: each either flags code the test owns, misses loads the run does not wait for, or warns on a form another rule requires.
- Tracking loads in the runtime: needs a loader hook in every host and leaves timing to the machine.

**Consequences.** No app or example in the repo reports W1608. k.ctx reads `implemented` until its five new clauses are covered and built. The kernel names `@keel/std-messages` as a string to recognise the call and imports nothing from it.
