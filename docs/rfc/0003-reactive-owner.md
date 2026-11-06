# RFC 0003: reactive: owner() exposes the current scope

Status: draft

## Problem
`@keel/store` `uses([...])` cannot bind a declaration to the calling scope: reactive exposes no owner identity, so store approximates (any live declaration restricts every caller). Store also needs to know when a scope ends (to drop its declarations and registry entry).

## Proposal
- `owner(): Scope | undefined`: the scope handle (the same object `scope(fn)` returns) that owns the running code; inside a computed or effect, the nearest enclosing scope; `undefined` outside any scope.
- Beyond `owner()`, the `Scope` handle gains two members, both required by the store changes:
  - `parent: Scope | undefined`: the enclosing scope, so `tx` can walk the caller's ancestors.
  - `onDispose(fn: () => void): void`: runs `fn` once when the scope is disposed (immediately if already disposed).

## Alternatives
- Owner token via `Symbol` only: cannot walk ancestors or observe disposal.
- Keep the E1205 probe in store: cannot tell which scope calls.
- Context API (`context(key, value)`): larger surface; not needed.

## Spec diff
k.reactive API line: add `owner()`; `Scope` shape `{ dispose, parent, onDispose }`. Conformance gains: "`owner()` inside `scope(fn)` returns that scope's handle; outside any scope it returns undefined; inside an effect it returns the scope that owns the effect".

## Conformance diff
Add `packages/reactive/conformance/owner.test.ts`. Existing tests unchanged.

## Migration
Additive. Store: `uses` becomes owner-scoped (a caller outside every declaring scope is unrestricted); `Snapshot` gains `initial`; default store id becomes `store.<n>`; `stores()` registry added; duplicate live ids throw.

## Token impact
About 60 tokens in k.reactive, about 120 in k.store.
