# RFC 0014: reactive: Scope.run(fn)

Status: implemented

## Problem
A node's owner is fixed at creation and an effect's rerun disposes what it owns, so an effect cannot create nodes under a stable scope. Runtime-dom's keyed list works around it with a "nursery": a chain of one-shot effects, one idle node per commit that adds rows (runtime-dom PLAN D4, D19).

## Proposal
`Scope.run(fn)`: runs `fn` with this scope as the current owner, returns `fn()`'s value. Reads inside do not subscribe an enclosing computation; writes are still checked against its `writes` (E1201). A throw propagates; the scope stays live. `run` on a disposed scope throws E1206.

## Alternatives
- `runIn(scope, fn)` free function: second spelling of owner access.
- `untrack(fn)`: removes tracking, not the ownership problem.

## Spec diff
k.reactive API: `Scope { dispose, parent, onDispose, run }`. Rules: `run` on a disposed scope is E1206. Conformance gains the sentence in Conformance diff.

## Conformance diff
Add `scope-run.test.ts`: "nodes created inside `scope.run(fn)` are disposed with that scope; `run` on a disposed scope throws E1206; reads inside `run` do not register dependencies of an enclosing effect".

## Migration
Additive. Runtime-dom drops `createNursery`.

## Token impact
About 60 tokens in k.reactive.
