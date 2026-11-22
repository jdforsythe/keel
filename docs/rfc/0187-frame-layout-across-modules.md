# RFC 0187: k.routes, k.module: a page names a layout of the module that composes it

Status: draft (ADR-0209 when accepted). From walkthrough finding S-3 (`tasks/p1/walkthrough-findings.md`).

## Problem
An app has one frame: a masthead whose navigation reaches every module's pages. In Keel today no module can own it.

- The frame's links need an `Href` per target page, and only the target's contract makes one (`c.href`, k.router Links). Importing a contract needs the target in `deps` (k.contract Derived, E1152). So the frame's module lists every module it links to.
- A page renders in the frame by naming it in its binding's `layout` (k.contract Binding, k.routes Layouts), and "`deps` must list its module" (`keel check` E1152 at `layout`; `packages/check/src/internal/modules/moduleChecks.ts`, `access`).
- A module holding the frame then lists each feature module, and each feature module lists it: E1153 for every pair.

`apps/household` shows the cost. Its modules form `members`, `receipts` ← `setup` ← `shopping` ← `app`. It carries one frame layout per module (`<module>.shell`), each rendering `members/Frame.tsx` with the links its own `deps` allow: the receipts book cannot link to the list, and the profile and setup pages link only to the profile and sign-out. A member on the receipts book goes back to the list with the browser's back button. Any app with a nav bar across modules meets the same wall, and the only shapes that pass are a frame per module with partial links, or all pages in one module.

The `layout` edge is the odd one. An import or a link is a use: the page's module reaches into the other. Naming a layout is a placement: the page asks to be rendered inside a frame. The frame's module, not the page's, is the one that composes the two: its `component` renders `children`, its loader and guard run first. The edge that matters already points from the frame to the pages.

## Proposal
D1. A binding's `layout` may name a layout of another module when either module lists the other in `deps`: the page's module lists the layout's (as now), or the layout's module lists the page's (the frame composes the page). E1152 at `layout` fires only when neither does. A `layout` creates no `deps` edge, so E1153 sees none.

D2. Nothing else changes. `routeTable` (or a manifest served alone) still throws E1506 when the id names no layout entry of the table or closes a cycle, so a frame in another deployable, or a typo, still fails where it does today. The page imports nothing from the frame's module, so E1151 and E1152 for imports are as they were.

For an app author: put the frame in the app-level module (`modules/app`, which already depends on every feature module), give it the full navigation from each feature contract's `href`, and have each feature page name `layout: 'app.frame'`. The feature modules keep their `deps` as they are.

```ts
// modules/app/routes.ts (app deps: members, receipts, setup, shopping)
'app.frame': { component: AppFrame, loader: loadFrame, guard: signedIn },
// modules/receipts/routes.ts (receipts deps: none)
'receipts.book': { component: BookPage, loader: loadBook, layout: 'app.frame' },
```

## Alternatives
- **Links by route id without a contract** (`hrefTo('shopping.list')` checked against `routes.json`). Rejected: a link is typed by the target's params and search schemas (k.router Links); a string id loses that, and it is a second way to make an `Href`.
- **A deployable-level frame** (`topology.ts`: `frame: 'app.frame'`, every page of the deployable rendered in it). Rejected: a second way to say `layout`, and pages that need another frame (sign-in, the signed-out masthead) would need an opt-out.
- **The composing module binds another module's pages** (`manifest(shopping, …)` in `modules/app/routes.ts`). Rejected: a manifest is its one module's route table (k.routes Union); moving bindings out of their module splits a module's routes across files.
- **Navigation data from the frame's loader** (hrefs as loader output). Rejected: the loader lives in the frame's module and has the same `deps`; an `Href` through a schema loses its brand.
- **One module for every page with the frame.** Works today and is what the walkthrough must not teach: modules exist to separate features.

## Spec diff
- **k.routes** Layouts: "`deps` must list its module (`keel check` E1152 at `layout`)" becomes "its module and the binding's must be related by `deps` in either direction: the binding's module lists the layout's, or the layout's module, which composes the page, lists the binding's (`keel check` E1152 at `layout` when neither does); a `layout` adds no `deps` edge (k.module E1153)." Conformance gains clause 10.
- **k.module** `deps` bullet: "app module ids or stdlib package names it may import from, link to or call" gains "; a page of a module it lists may name its layouts (k.routes Layouts)". Conformance gains clause 15.
- **Ledger**: `k.routes#10` and `k.module#15` at `none`.

## Conformance diff
By the `conformance-writer`, under `rfc:0187`, from the spec text alone (`packages/check/conformance/`):
- k.routes 10: modules `app` (deps `['shop']`, a layout `app.frame`) and `shop` (deps `[]`, a page with `layout: 'app.frame'`): `keel check` reports no E1152 and no E1153, and the served chain of the page is `app.frame`, then the page. With `app`'s deps `[]` as well, one E1152 at `layout`.
- k.module 15: modules `a` and `b` where `a` lists `b` and a page of `b` names a layout of `a`: no E1153; `a` and `b` listing each other: one E1153 naming both.
Spec topics: `pnpm spec k.routes`, `pnpm spec k.module`, `pnpm spec k.contract`; for context `pnpm spec k.router`.

## Build
- `@keel/check`: `access` in `moduleChecks.ts` accepts a `layout` whose module lists the binding's module; the E1152 message and `EXPLANATIONS` row name both directions.
- `apps/household`: one frame `app.frame` in `modules/app` with List, Receipts, Profile, Setup and Sign out; the per-module `*.shell` layouts and `members/Frame.tsx` go; the signed-out pages keep a frame in `members`.
- Skills: keel-client (layouts: a frame shared by every module lives in the module that depends on them all; pages name it by id).

## Migration
None: unreleased.

## Token impact
k.routes about 5,989 to 6,250 characters; k.module about 5,860 to 6,000. No budget moves.
