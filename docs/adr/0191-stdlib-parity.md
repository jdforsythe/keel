# ADR-0191: k.parity: the stdlib holds no power a library lacks (RFC 0169)

**Status:** proposed (for the operator to confirm).

**Context.** The stdlib imports kernel `internal` entries eight times for five functions (`secretPathOf`, `sampleFormat`, `report`, `findRouter`, `mountRequests`), which E1576 refuses to app and library code, and the kernel gates `./tools`, `std` config, module discovery, `./routes`, a component heuristic and an E1111 allowance on the name `@keel/std-*`. D49 asks that the stdlib hold no power a library lacks; RFC 0163 checks a library's files as app code.

**Decision.** `secretPath(schema)` is public in `@keel/schema`; `sampleFormat` is public in `@keel/schema`, as its one caller runs in the browser and a runtime package must not depend on the test harness. `TableSearch` calls the public `navigate` inside its own `owner()` scope and takes its clock from `ctx` only; std-sessions writes E2003 into its own recorder. Name gates become kind gates (`"keel": "library"`); a library may declare format types; a detached scope lives under `unsafe/` in the stdlib and a library alike. Three closed sets stay named, each for 1.0: shells (`mountRequests` stays internal for std-capacitor and std-tauri), topology storage and shells in generated entries, and the CLI command slots. `tooling/structure-lint.mjs` enforces it from `tooling/deps.json` (`internal`, `names`): S0012 and S0013; in an app, E1576 over library files with the shell allowance.

**Alternatives.**
- All five public: `report` forges ctx events, `findRouter` exports `Form`'s seam, `mountRequests` is the closed shell contract.
- A named stdlib list in E1576: powers by name, which D49 refuses.
- `sampleFormat` in `@keel/testing/sample`: a runtime package would depend on the test harness.

**Consequences.** A library can do what the stdlib does, but for the three closed sets; opening one is additive. The four stdlib detached-scope sites move under `unsafe/` (count +4, justified). The std.tables fixtures pass `ctx` to `TableSearch`. The kind gates are built after RFC 0163.
