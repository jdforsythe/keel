# ADR-0234: k.guards: a guard several modules bind lives in a module of its own; E1153 names the guard (RFC 0212)

**Status:** accepted (orchestrator, 2026-11-24).

**Context.** A `routes.ts` binds a guard by value import, so the binder lists the guard's module in `deps`. A link imports the target's contract, which is a `deps` entry too. When the guard's module links to a page of a module that binds the guard, `deps` is a cycle (E1153). The walkthrough moved the guard into a module that links to nothing, but neither the spec nor the diagnostic named that arrangement. A guard file outside every module escapes the `deps` checks and is refused by a `client` build (E1007).

**Decision.**
- No new construct. k.guards Home: a guard lives in a `*.guard.*` file of a module. A guard bound by modules that link to one another lives in a module of its own: no pages, its files guards and what they import, its `deps` reaching no module that binds them. Each binding module lists it. A guard's `redirect` stays a route id resolved in the deployable's table, so it needs no `deps` entry.
- A file outside every module is not a home. No rule refuses one: k.module already says all app code lives in modules.
- E1153 names the guard. When a module of the listed cycle imports from a `*.guard.*` file of the module after it, the message is `module deps cycle through guard <name>: <ids>` and `see` is `k.guards`. `<name>` is the stem of the first such file along the cycle, the first by path within one edge. Other cycles keep their message.
- E1153's location (the smallest module id's entry naming the next module of the cycle) is stated in the spec.

**Alternatives.**
- A guard referenced by name through a registry: a second way, with no type.
- A contract import that makes no `deps` edge: a second notion of dependency, against RFC 0204 and the CI job's `deps` walk.
- An app-level guard file: `node` only, and its imports go unchecked.
- A move fix on E1153: the target module and its id are the author's call.

**Consequences.** `depsCycles` reads the guard imports `moduleChecks` already scans, `moduleDiag` takes a `see`, and `keel explain E1153` names the guard module. `apps/household` is unchanged: `members` already reaches no module that binds its guards. k.module gains clauses #21 and #22.
