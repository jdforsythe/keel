# W13 L4 (compiler, module schema): what it leaves for others

Branch `w13-l4`, built; merges into `lane-r157` after L3's merge there. Its follow-up is in (4a550990): `public` is a closed object holding only `exports`, as k.module lists it, so a stale `routes` key is refused.

## Red list
compiler 6 failing files, 4 type errors to 3 files, 6 errors (the 6 are in conformance and were there before: child-gets-parent-ctx 3, intrinsic-call-import 2, render-purity 1); unit and conformance 1,140 passed, 3 failed. cli 56 failing files to 61, with churn: 19 newly red and 14 newly green. The new reds sampled come from old-shape fixtures meeting the new router types, from check's E1111 not reading `manifest(contract, binding)` yet (L6), and from old-shape golden-1 (`test/golden.test.ts`, `check-budget-injected10`; stage 4). `cli/test/buildTrailer.test.ts` stays red on its old-shape `routes.ts`.

## For the conformance-writer
- compiler `module-manifest`: line 16 generates `public.routes` in valid modules; drop it there. Line 58 (it is refused) is right.
- compiler `route-fragment-spread-0077`, test 1: lines 4 and 96 place `@keel/std-frag` by package name; it is placed as `frag`, with a package `module.ts` (`id: "frag"`) and an app `modules/m/module.ts` listing the package in `deps`.

## For L6 (check, cli)
- `routes.json` per route: `{ actions, api?, guard, layout, method?, module, params, path, search }`; an API entry has `api: true`, `method`, its `query` under `search`, and `actions` equal to `[method]` for a write; a layout has `path: null`.
- `surface.json` version 2 is assembled in the cli as k.compat lays it out, taking `callers` from the compiler's new `contractCallers(files)`. A throwing contract is already E1006 from the routes evaluation: the surface step does not report it again.
- compiler `shell-entry` conformance waits for check: E1111 cannot read `manifest(contract, binding)` yet.
- E1501's message still says "use `routes.href`" because `check/test/mutants.test.ts` snapshots it: change both. `routesMismatch` should compare `method`.
- `routeLiterals` gives each route its contract `file` and `method`; spreads, computed keys or an unreadable contract are W1005, named, and unread only that module's routes. E1559 and E1579 are reported in the contract file. E1558 reads the four-argument loader and action, the namespace form and `{ ...base }`.
- Build: each contract file is evaluated before its binding; a throw, or a `routes` export that is no route table, is E1006.

## For L3 (merged view)
Generated server, dev and client entries call `routeTable(...)`; the server entry passes `routes: routeTable(...)` to `start`. L3 built `start` taking `routes: RouteTable[]`: make the two agree at the merge (a table is accepted, or the entry passes the list).
