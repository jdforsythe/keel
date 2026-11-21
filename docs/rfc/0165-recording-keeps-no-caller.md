# RFC 0165: k.user: a recorded session keeps no `meta.caller`, whatever the caller lifetime

Status: implemented (ADR-0187). For backlog 0867.

## Decisions
- D1: a std.sessions recording keeps no transaction `meta`, under any caller lifetime. It never needs to learn the lifetime, so nothing carries `caller: { days }` to the browser.
- D2: this is the lane 09 recommendation ("capture always replaces `meta.caller`") in its strongest form: always, and by omission rather than by a generated value, since a recorded `tx` event has no field to put one in.
- D3: a caller hash an app keeps in a store's state or a payload is app data; the app marks that field `.pii('network')` and the recorder redacts it as any marked value.

## Problem
RFC 0139 D9 says "std.sessions' capture replaces a recorded `meta.caller`" under `caller: { days }`, and k.user's Conformance asked that a capture "holds a generated value; without it" (the hash, in RFC 0139's text). Neither says how a recording learns the lifetime. It cannot: `record` runs in the browser (std.sessions: without a global `document` it records nothing through transactions), `caller: { days }` is a `topology.ts` field the server reads, and nothing sends it to a page.

What the code records, read on 2026-11-21:
- `packages/std-sessions/src/internal/recording.ts` `pull`: a `tx` event is `{ at, kind: 'tx', store, name, payload }`; the entry's `meta` is never read. `SessionEvent.ts` has no `meta` field.
- The base `state` is each store's `snapshot().state` (`snapshot`), with no log.
- k.store Log meta: `snapshot()` drops `meta` from every entry, so `#k-state` brings a page no `meta` either.
So a recording already holds no `meta.caller`, with or without `days`. The spec promises a replacement the code does not make, and its "without it, the hash" half (RFC 0139) is a leak the code does not have. `packages/std-sessions/conformance/caller-network.test.ts`, which `packages/cli/conformance/evidence-caller.test.ts` names as its other half, does not exist.

A std.multi group's `server` (`openGroup`'s `server` option, stored values with log `meta`) is the test author's fixture under a sim ctx, not a recording of a person, and stays as it is.

## Proposal
k.user Caller lifetime states that a recording keeps no `tx` `meta`, whatever the lifetime, and drops the capture clause. Its Conformance bullet splits in two: `pii.json` alone, and a recording with or without `days`. No code changes; the conformance test is new.

```ts
// A page transaction carrying a caller hash in its meta (the hash came from a loader).
const s = record(ctx)
tx(addItem, { sku: 'a' }, { meta: { caller: hash } })
const json = JSON.stringify(s.stop())
// json holds neither "meta" nor hash, under caller: { days: 30 } and without it.
```

## Alternatives
- Send the lifetime to the page (a `#k-state` field) and replace `meta.caller` only under `days`: a new field on every page for a value the recorder does not need, and `meta` is still not recorded today.
- Record `meta` and replace `caller` in it always: adds a field to `Session` (schema change, replay unaffected) to carry data no replay reads.
- Treat every `meta` value as `.pii()`: same outcome as dropping it, with a schema change.

## Spec diff
- k.user Caller lifetime. The text "..., so std.sessions' capture replaces a `meta.caller` it records, and the evidence bundle's ..." becomes "..., and the evidence bundle's `pii.json` holds ... (`{ days: null, class: null }` without it). A std.sessions recording keeps no `tx` `meta`, so no `meta.caller`, whatever the lifetime."
- k.user Conformance. Two bullets replace one: "With `caller: { days: 30 }`, `pii.json` has `caller: { days: 30, class: 'network' }`; without it, `{ days: null, class: null }`." and "With or without it, a std.sessions recording of a `tx` with `meta: { caller }` holds neither `meta` nor the hash."
- k.user Identity source, to make room. The sentence "An auth library's sign-in, callback and sign-out endpoints live here and set their own cookies." becomes "An auth library's endpoints live here."

## Conformance diff
By the `conformance-writer`, under `rfc:0165`:
- `packages/std-sessions/conformance/caller-network.test.ts` (new): under a sim ctx with a document, `record`, a `tx` with `meta: { caller: <64-hex hash> }`, `stop()`: the session JSON holds no `meta` key and not the hash; the same with the store restored from a `snapshot({ meta: true })` holding that meta.
- `packages/cli/conformance/evidence-caller.test.ts`: retag its header to the new `pii.json` bullet (the old one is gone, so the ledger item moves to the new text).
- `packages/server/conformance/identity-handle.test.ts`: retag its `Identity source` quote to the shortened sentence (not ledger-counted).

## Migration
None. An app that keeps a caller hash in store state marks that field `.pii('network')` (D3); the keel-compliance skill's caller paragraph says so in the build commit.

## Token impact
k.user 1,500 to 1,499 tokens; 10 Conformance clauses (`docs/freeze-review.md`). Map unchanged.

## Build order
1. This commit. 2. `conformance-writer`. 3. Build: no code; the skill sentence; flip any ledger gap.

## For the operator
- RFC 0139's "without it, the hash" is reversed: the hash is never recorded. Recommendation: confirm; a recorder that never sees `meta` cannot leak it.
