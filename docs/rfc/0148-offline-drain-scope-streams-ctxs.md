# RFC 0148: std.offline: a drain's scope drops its retry, stream endpoints are refused, ctxs keep their entries apart

Status: accepted (ADR-0170) under the RFC defaults (6: enforce in the library), for the orchestrator to confirm. For backlogs 0797, 0798 and 0799.

## Decisions
- D1 (0797): when the scope of `drain` ends, the retry its ctx has pending is dropped, so nothing is posted after it on that ctx until the next `send`, `resolve` or `drain`.
- D2 (0798): `outbox` throws E2652, an Error with `code`, for an api with an `events: true` endpoint. No check rule: the throw happens at declaration, on first import.
- D3 (0799): an outbox keeps each ctx's entries apart. A ctx holds the entries it added (`send`) or loaded (`drain`, the first `send` or `resolve`); its owner change, flush, retry, `resolve` and storage writes reach only those. The store stays one per outbox and shows every ctx's entries.

## Problem
Read on `lane-w01` at `a9e4ad92`; red-team items in `tasks/0338-s8-reach/proposed/red-team-7.md` (L2, L3, L4).

- 0797: the flush arms one retry timer per outbox (`packages/std-offline/src/internal/flush.ts`). `drain` disposes only its `net` observer when its scope ends, and `c.live` follows the scope that declared the outbox, so for a module-level outbox a pending 1 to 60 s retry still runs and posts after the page that drained it is gone.
- 0798: `outbox` accepts an `events: true` endpoint. Its client call returns an `AsyncIterable`, `outcomeOf` reads `.error` of a value that has none, the flush throws, and the entry stays `sending`, which every reload loads as `queued` and throws on again.
- 0799: the store, the flush state and the retry timer are one per outbox while the owner is per ctx. With one module-level outbox used from two ctxs (tests, golden-1's `boardOutbox`), `send` or `drain` with owner `b` on ctx B fails ctx A's live entries of owner `a`, and each ctx's storage write holds the other's entries.

## Proposal
- `src/drain.ts`: `sc.onDispose` also aborts the ctx's retry timer.
- `src/outbox.ts`: before anything else, an endpoint with `events: true` throws `E2652 outbox <id> endpoint <name> answers a stream` with `code: 'E2652'`.
- `src/internal/Config.ts`: `busy`, `delay`, `timer` and `again` move into a per-ctx record `flows: WeakMap<Ctx, Flow>`, which also holds `held: Set<string>`, the keys that ctx added or loaded. `send` and `load` add to `held`; `flush`, `own`, `resolve` and `persist` read `held`. `persist` writes the store's entries whose key the ctx holds. `full` counts the whole store, as now.

## Alternatives
- 0797, a per-drain live flag: the timer still fires and runs a loop that must then check it; aborting the timer is the smaller change.
- 0798, a check rule: the runtime throw already fails closed for every caller; a rule can follow if wanted.
- 0799, one ctx per outbox (a second ctx throws): breaks golden-1, whose module-level outbox meets a new ctx per test, and any app test suite like it.
- 0799, one store per ctx: `Outbox` reads (`get`, `select`) take no ctx, so a page could not see its entries.

## Spec diff
- std.offline Flush, the `drain` sentence: "and flushes, again on each reconnect until the scope ends, which drops a pending retry." The `send` paragraph's error list is tightened: "`offline.full` (at `limit` entries or `maxBytes` encoded), `offline.storage` or `offline.owner`. Storage faults and other throws in a flush: std.outbox." Conformance, appended: "- Once the `drain` scope ends, its pending retry posts nothing."
- std.outbox Other throws, appended: "An `events: true` endpoint answers a stream no entry can settle on, so `outbox` throws E2652 for one." Conformance, appended: "- `outbox` throws E2652 (an Error with `code`) for an api with an `events: true` endpoint."
- std.outbox-owner, new paragraph before Rules: "**Ctxs.** One outbox used from several ctxs (one declared outside a scope, in tests or on a server) keeps their entries apart: a ctx's owner, flush, retry, `resolve` and storage writes reach only the entries that ctx added or loaded. The store shows them all." Conformance, appended: "- With one outbox declared outside a scope, entries queued offline on ctx A with owner `a`, then `drain` with owner `b` on ctx B online: A's entries stay `queued`, none is posted, B's `keel.outbox.<id>` holds none of them, and `resolve` on B for one resolves `false`; a later `drain` with `a` on A online posts each once with its key."
- spec/std/README.md: std.offline's row names E2651-E2652.

## Conformance diff
Additions only, by the `conformance-writer`: `packages/std-offline/conformance/drain-scope.test.ts`, `stream-endpoint.test.ts` and `ctxs.test.ts`, one per new bullet. No existing file changes.

## Migration
None for apps: an outbox over an `events: true` endpoint never worked. golden-1's tests each use a new ctx over the module-level outbox and keep passing.

## Token impact
std.offline 1,497 to 1,498 tokens; std.outbox 1,330 to 1,379; std.outbox-owner 839 to 988.

## Known limits
Two tabs of one browser are two outboxes over one storage key: each writes its own entries, so one tab's write drops the other's from storage until that tab writes again. Not changed here (backlog 0800).
