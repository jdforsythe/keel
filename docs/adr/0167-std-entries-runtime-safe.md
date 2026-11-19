# ADR-0167: every std package's runtime entries reach no CLI-time package (RFC 0145)

**Status:** accepted

**Context.** A deployable that imports a std entry bundles that entry's import graph. An entry that reaches `@keel/cli` or `@keel/check` carries vite, vitest, typescript and oxc-parser, and `keel build` fails. RFC 0144 fixed `@keel/std-report`; the rule was unstated and unchecked. A bundle of all 62 `exports` entries of the 25 std packages finds three offenders: the main entries of `@keel/std-conflicts` (a formatter and two rules) and `@keel/std-brands` (its one rule), and `./action` of `@keel/std-sessions` (a formatter registered beside a schema). The main entry of `@keel/std-sessions` is clean.

**Decision.**
- C1: k.module states the rule once: only a std package's `./tools*` and `./module` entries may reach `@keel/cli`, `@keel/check`, `vite`, `vitest`, `typescript` or `oxc-*`; rules, formatters and commands register in `./tools`. `@keel/compiler` is not listed: its root is caught through `oxc-parser`, and its `std/*` and `inspect/*` subpaths are runtime.
- C2: `./tools`, keys under it and `./module` are the exempt entries.
- C3: structure lint S0009 in `pnpm check` bundles every other entry of every `packages/std-*` package and reports the first edge into a CLI-time package. No E code is reserved.
- C4: `@keel/std-conflicts` keeps its exports; the `conflicts.race` formatter and the rules E2701 and W2702 register from a new `./tools`.
- C5: `@keel/std-brands` is CLI-time whole: `idBrandCase` moves to `./tools` and the main entry is empty. std.brands bullet 1 stays as written and is read of the package, loaded through `./tools`.
- C6: `@keel/std-sessions` moves the `session` formatter call off `SessionRecord.ts`; no export moves and std.sessions is unchanged.
- C7: k.module keeps its status; std.conflicts and std.brands are `implemented` until their conformance lands.

**Alternatives.** A build-time assertion with a reserved code on the server bundle (protects third-party packages, but no rule family walks that graph today and k.boundary and k.deploy, which would hold it, are at their token limit; a backlog line). A bundle bullet per package (25 copies). One k.module bullet over every std entry (a kernel suite reading the stdlib's layout, in a section with no room). Exempting std-brands or `./action` (an exemption list for a rule meant to be general). Listing `@keel/compiler` whole (fails clean entries of five packages).

**Consequences.**
- `pnpm check` fails when a std runtime entry gains a path to the CLI or the checker, and names the chain.
- Code that imported `idBrandCase` from `@keel/std-brands`, or relied on `@keel/std-conflicts` registering its formatter and rules, imports the tools entry: two conformance files, one eval acceptance test, package tests.
- A std-style package outside this repository is bound by the sentence in k.module and, for browser builds, by E1007; its server build has no gate.
- `@keel/testing` stays reachable from three std-sessions subpaths, as std.sessions states.
