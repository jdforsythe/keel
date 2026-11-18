# RFC 0125: a throwing `onDispose` hook stops no disposal

Status: accepted (orchestrator under the owner's standing leave, 2026-11-17). For backlog 0732. It specifies the build as 0731 left it and changes no behaviour.

## Problem
k.reactive does not say what a throwing `onDispose` hook does. The code (`packages/reactive/src/internal/dispose.ts`, `disposeOwned.ts`, `runAll.ts`, `scope.ts`) does this:
- `dispose(n)` marks `n` gone, then runs, in order, the disposal of every node `n` owns (in creation order, each by the same rule), the unlinking of `n`, and `n`'s hooks in registration order. A throw from one step does not stop the next: every owned node is disposed and every hook runs.
- After the last step the first error in that order is rethrown from `dispose()`. An owned node's error comes before a hook of `n`, because owned nodes are disposed first. Later errors are dropped.
- `scope(fn)` rethrows `fn`'s own error when `fn` throws, and `scope.run(fn)` does the same; the hook error that disposal also threw is dropped. When `fn` returns and a hook threw, the hook's error is rethrown.
- An effect or computed rerun disposes what its previous run created; a hook error there does not stop the rerun, and the first error (a hook's or the run's) is rethrown after it.

Judged against docs/PRINCIPLES.md this is sound: it keeps the graph consistent (no owned effect stays alive beside its replacement, principle 10) and rethrows rather than swallows. One edge is surprising: when several hooks throw, only the first error is visible and the rest are dropped without a report. That is a small loss of information, not a defect to specify around; reporting all of them would need a new aggregate error, and no task has asked for one. The spec states the rule as built.

## Proposal
State the rule in k.reactive's API paragraph and add one Conformance bullet. No source change.

## Alternatives
- Stop at the first throwing hook (the build before 0731): later children stay alive, and an effect rerun leaves its earlier owned effect running beside the new one.
- Swallow hook errors: hides an app bug; a hook that throws is a defect the caller should see.
- Rethrow an aggregate of every hook error: a new error type and shape for a case no app has reported; listed in tasks/FUTURE.md terms, not built.
- Route a hook's error to the scope's `onError`: `onError` is for effects and computeds after the commit; a `dispose()` call has a caller to throw to.

## Spec diff
k.reactive (before 4,470 characters, 1,118 tokens; after 5,100 characters, 1,275 tokens). No trim needed.

Appended to the API paragraph, after "its first value after a throw counts as a change.":
```
Disposing a scope, effect or computed disposes every node it owns, then runs its `onDispose` hooks in registration order; a throwing hook stops none of this, and `dispose()` rethrows the first error (an owned node's before the node's own hooks') and drops the rest. `scope(fn)` and `scope.run(fn)` rethrow `fn`'s own error in place of a hook's.
```

Appended as Conformance bullet 20 (bullets 1-19 keep their order and text):
```
- A throwing `onDispose` hook stops no disposal: every owned node is disposed and every later hook runs, `dispose()` rethrows the first error in disposal order (owned nodes before the node's own hooks, hooks in registration order), and `scope(fn)` rethrows `fn`'s error over a hook's.
```

## Conformance diff
One `rfc:0125` commit by the `conformance-writer`: new `packages/reactive/conformance/dispose-hook-throw.test.ts`, citing k.reactive Conformance 20. Cases: a scope owning three effects and two hooks, the first owned effect's hook and the first scope hook throwing: every effect is gone, the second scope hook ran, and `dispose()` throws the owned effect's error; two scope hooks throwing: the first one's error is rethrown; `scope(() => { throw a })` with a throwing hook rethrows `a`; `scope.run(fn)` likewise.

## Migration
None. Code that relied on the first throwing hook leaving later children alive had a leak; the build already behaves as specified.

## Token impact
k.reactive 1,118 to 1,275 tokens (4,470 to 5,100 characters), under the 1,500 limit. No other section changes.
