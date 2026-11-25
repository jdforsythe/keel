# RFC 0212: k.guards: a guard several modules bind lives in a module of its own; E1153 names the guard

Status: accepted (ADR-0234), accepted by the orchestrator on 2026-11-24. Amends k.guards (a Home paragraph), k.module (Rules E1153, Conformance). From `apps/household` (walkthrough finding L4-4, backlog 1019).

## Decisions
- D1: no new construct. A guard lives in a `*.guard.*` file of a module and is bound by value import, as today. A guard bound by modules that link to one another lives in a module of its own: no pages, its files guards and what they import, its `deps` reaching no module that binds them. Each binding module lists it. This is the one home, stated in k.guards Home.
- D2: a guard's `redirect` stays a route id resolved in the deployable's route table, so a guard module names another module's sign-in page with no `deps` entry. Nothing changes in the router.
- D3: a file outside every module is not a home. k.module does not check its imports, and k.boundary makes it server-only in every deployable, so a `client` deployable's build refuses it (E1007). No new rule refuses one: k.module already says all app code lives in modules, and no app or example puts a guard there.
- D4: E1153 names the guard. When a module of the listed cycle imports from a `*.guard.*` file of the module after it, the message reads `module deps cycle through guard <name>: <ids>` and `see` is `k.guards`. `<name>` is the file name up to its first dot (`y` of `y.guard.ts`) of the first such file along the cycle: the first edge of the listed cycle that has one, its first file by path. The guard comes before the cycle, so the 89-character clip cuts the cycle's tail and never the guard. A cycle with no guard import keeps its message and `see: k.module`.
- D5: the spec states where E1153 lands (the smallest module id's entry naming the next module of the cycle, at the id's opening quote inside `deps: [...]`), which `depsCycles` does today, so the conformance clause can quote a location.

## Problem
A page binds a guard in its `routes.ts` by value import (`guard: signedIn`), so the binding module lists the guard's module in `deps` (E1152). A link to a page imports that page's contract (k.contract Derived: `href`), which is a `deps` entry too. So when the guard's module also holds a page that links to a page of a module binding the guard, `deps` is a cycle:

```
E1153 modules/members/module.ts:4:10 module deps cycle: members -> shopping -> members
fail check 1 errors
```

`members` holds `signedIn.guard.ts` and the sign-in page; `shopping` binds `signedIn` on the list page; the sign-in page wants a link to the list. The walkthrough met this in layer 4 (L4-4): with the setup guard in `app`, `shopping` listed `app` to bind it, and `app`'s start page listed `shopping` to link to the list. The guard moved to its own `setup` module, which links to nothing, and the cycle went away. Nothing in the spec or in the diagnostic said that was the way: E1153's message lists the cycle, and `keel explain E1153` says "move the shared code into a module both depend on" without saying that a guard is that shared code.

What the tree does today:
- `apps/household`: `members` holds `signedIn.guard.ts` and `member.guard.ts` (both in `public.exports`) and lists no app module. `receipts`, `setup` and `shopping` list `members` and bind the guards. The sign-in page links only within `members`; after a sign-in, `identity.server.ts` (outside every module) redirects to `next` or `app.href('app.start')`. So `members` is the guard module the Home paragraph names, holding pages as well, which works while those pages link nowhere else.
- `apps/golden-1`, `apps/golden-2`, `examples/shell-mount`: each guard is bound only by its own module.
- No app or example has a guard file outside every module. `moduleChecks` skips such files, `resolveImport` maps an import of one to no module, so a module importing one needs no `deps` entry and E1153 never sees the edge. It works on a `node` deployable (the file is server-only and bundled into the server); on a `client` deployable the browser build stubs it and E1007 refuses it.
- A guard's `redirect` resolves in the router's whole route table (`runGuards`' `byId`, `createRouterWith`'s `own`), the household's `signedIn` redirecting to `members.signin` from `shopping`'s pages today.

## Proposal
### Home
k.guards gains a Home paragraph:
- A guard lives in a `*.guard.*` file of a module. A module binding another module's guard lists that module in `deps`, and that module may then neither list the binder nor link to its pages (a link imports the binder's contract): E1153, naming the guard.
- A guard bound by modules that link to one another lives in a module of its own: no pages, its files guards and what they import, its `deps` reaching no module that binds them. Each binding module lists it.

```
modules/access/    deps: []                     public.exports: ['signedIn']   signedIn.guard.ts
modules/members/   deps: ['access', 'shopping']  routes.ts binds signedIn; the sign-in page links to shopping.list
modules/shopping/  deps: ['access']             routes.ts binds signedIn
```

- The redirect is a route id, not an import: `signedIn` names `members.signin` with no `deps` entry.
- A file outside every module is not a home, for the reasons in D3.

`deps` stays acyclic, and a guard module's guard may import what any module file may import: its own files, the public exports and contracts of modules in its `deps`, and packages. It can read a store of a data module it lists, as long as that module reaches no module binding the guard.

### E1153
```
E1153 modules/members/module.ts:4:10 module deps cycle through guard signedIn: members -> shopping -> members
fail check 1 errors
```
- The cycle is the one `depsCycles` lists today: the shortest from the component's smallest module id, reported at that module's entry naming the next.
- An edge `x -> y` of the listed cycle is a guard edge when a non-test file of `x` imports from a `*.guard.*` file of `y`, by the import forms k.module Checks counts as a use.
- The first guard edge along the cycle names the guard: its first guard file by path, by stem (`signedIn.guard.ts` -> `signedIn`).
- The diagnostic's `see` is `k.guards`, so compact output prints `see: keel docs k.guards`.
- A guard in a `*.server.*` file (E1009 allows one) gets the plain message: the rule reads file names, as k.boundary does.

`keel explain E1153`:
```
E1153 cycle in module deps (message lists the cycle).
A deps edge is an import, a contract's among them, so a link is one. A guard bound by modules that link to one another closes a cycle when it sits in one of them; the message then names it (k.guards Home).
fix: move the shared code into a module both depend on; for a guard, a module of its own with no pages
see: k.module
```

### What does not change
- E1152, E1165, the router, `manifest` and `routeTable`.
- `apps/household`: `members` reaches no module that binds its guards, so it is a guard module that also has pages, and it stays as it is.
- No new code, no new glossary term.

## Alternatives
- **A guard by name.** Bind `guard: 'members.signedIn'`, resolved from a registry like a redirect, so the binder needs no import. That would be a second way to reference a guard, it would need a registry the router does not have, and it would lose the value's type. Rejected.
- **A contract import makes no `deps` edge.** A link would cost nothing, and the cycle would go. But RFC 0204 made a contract import a use of `deps`, a deployable's CI job follows `deps` for the modules it runs, and two kinds of edge would be a second notion of dependency. Rejected.
- **An app-level guard file** (`guards/signedIn.guard.ts` beside `topology.ts`). It works on `node` only (E1007 on `client`), and it hides the guard's imports from E1152 and E1153. Not the home. A rule that refuses one was considered and not added (For the operator, 2).
- **A fix on E1153** that moves the guard (`keel codemod move`). The target module usually does not exist, and choosing its id is the author's call. The message and `see` point at the arrangement instead.
- **Name the guard after the cycle.** The 89-character clip would cut it from long cycles.

## Spec diff
Applied in this commit.
- k.guards (stays `conformance-covered`): a Home paragraph after Guards. It adds no clause; k.module's clauses cover it.
- k.module (stays `implemented`): the E1153 rule states its location and the guard message; Conformance gains two clauses (#21, #22).
- Map: unchanged. No section, glossary term or code is added.
- Ledger: k.module#21 and #22 show at `none` through `ledger-fresh` until the orchestrator regenerates it.

## Conformance diff
By the `conformance-writer`, from the spec text.
- `packages/check/conformance/module-E1153-guard-home.test.ts`: k.module#21 and #22 over file maps, as `module-E1153-deps-cycle.test.ts` builds them (`module-support.ts`). It asserts code, path, line and column of the entry, message and `see`.
- Existing cases: `module-E1153-deps-cycle.test.ts` and `packages/check/test/modules.test.ts` import no guard file, so their messages hold. The writer confirms no existing fixture with a cycle imports a `*.guard.*` file.

## Migration
None. No app is released, and no app's cycle runs through a guard.

## Token impact
- Spec: k.guards grows by about 260 tokens, k.module by about 330. Both stay under the 3,100-token section budget (`node tooling/budgets.mjs`).
- `keel explain E1153`: about 30 tokens more, under its 300-token budget.
- `@keel/check`: a lookup over imports `moduleChecks` already scans; measure against its budget in the build.

## Build plan
1. This commit: RFC, ADR, spec text. 2. `conformance-writer`: k.module#21 and #22. 3. Build:
- `packages/check/src/internal/modules/depsCycles.ts`: take, per module, the `*.guard.*` files of other modules its non-test files import (from the `Scanned` list `moduleChecks` holds), find the first guard edge along the listed cycle, and pass the message and `see: 'k.guards'`. `moduleDiag` gains an optional `see`.
- `packages/check/src/internal/EXPLANATIONS.ts`: E1153's explanation and fix as above.
- Docs: the `keel-server` skill's guard lines (`packages/cli/skills/keel-server/SKILL.md`, copied to `.claude/skills`): where a guard lives; the `@keel/check` README if it lists E1153's message; a changeset for `@keel/check`; `tasks/p1/walkthrough-findings.md` (L4-4); `tasks/BACKLOG.md` 1019.

## For the operator
1. **No new construct.** The answer is the module arrangement the walkthrough already reached, stated in k.guards Home, with E1153 naming the guard. Recommended: yes. A guard by name or a free contract edge would each be a second way.
2. **No rule refuses a guard file outside every module.** k.module says all app code lives in modules, the Home paragraph says why such a file is not a home, and no app has one. If you want it enforced, E1009 could also cover a `guard` use outside every module of a project that has modules.
3. **The household stays as it is.** `members` is already a guard module that also has pages, and its sign-in page links only within `members`.
