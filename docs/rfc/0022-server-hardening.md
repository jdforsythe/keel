# RFC 0022: Server hardening

Status: draft

## Problem
Red team 2026-11-06 H1-H3, H5, M2, M10: `createApp` defaults to dev (golden-1 serves inspect and error text); inspect answers any loopback origin; writes lack CSRF checks; a `__proto__` field sets the prototype of submitted values; `#k-state` leaks exposed logs; overlapping requests creating one store id collide.

## Proposal
- `mode` defaults to `production`; golden-1's entry reads `NODE_ENV`.
- Inspect (dev only) answers a loopback or listed host whose `Origin` is absent, its own, or in `inspect: { origins }`; else 403 `keel.denied`. The Vite middleware gates GET and POST; `KEEL_INSPECT_ORIGINS` adds origins (`:*` any port).
- A write passes on `Sec-Fetch-Site` `same-origin`/`none`, `Origin` equal to the request's, `accept: application/json` plus `x-keel: 1` (the services client sends it), or neither header (not a browser); else 403 `keel.denied`. `_method` only overrides POST.
- Submitted values drop `__proto__`, `constructor`, `prototype`.
- An exposed store's `#k-state` entry is `{ state, log: [], initial: state }`; `expose: [{ store, log: true }]` keeps the snapshot.

Store: `isolate(scope)` gives a scope its own registry. `store()` registers in, and `stores()` reads, the registry of the nearest isolated scope on the owner chain, else the module registry; a duplicate id throws within one registry. Request scopes are isolated.

## Alternatives
Rejecting header-less writes: happy-dom strips `Origin`.

## Spec diff
k.server Request flow, Dev server; k.store Ids; k.cli Inspect.

## Conformance diff
Store adds `registry-isolate.test.ts`; server none.

## Migration
Dev node entries pass `mode: 'dev'`.

## Token impact
None.
