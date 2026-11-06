# RFC 0007: harness hooks: mount onError; store and transaction expose schema

Status: implemented

## Problem
`@keel/testing` cannot observe an error the root Boundary renders except by scraping `<pre data-k-error>`, and cannot generate store states or transaction payloads: `Store` and `Transaction` hide their schemas (`Transaction.payload` exists, but `Store` has none), so it needs a side channel.

## Proposal
- `mount(App, el, { ctx?, onError? })`. When the default root Boundary catches an error it renders the fallback and calls `onError(error: KeelError<'keel.unexpected'>)` with the same error object. A throw inside `onError` is not caught by the Boundary.
- `Store<T>` exposes readonly `schema: Schema<T>` (and the existing `id`). `Transaction<T, P>` exposes readonly `schema: Schema<P>` (the payload schema) and `store: Store<T>`. `Transaction.payload` stays as an alias.

## Alternatives
- Harness-side registries of schemas: a side channel that drifts from the store.
- Parse `data-k-error` from the DOM: lossy, loses `code` and `data`.

## Spec diff
k.runtime: `mount` options gain `onError`. k.store: `schema`, `id` on stores; `schema`, `store` on transactions.

## Conformance diff
Add `packages/runtime-dom/conformance/mount-onerror.test.ts` and `packages/store/conformance/schema-exposed.test.ts`. Existing tests unchanged.

## Migration
Additive.

## Token impact
About 60 tokens across k.runtime and k.store.
