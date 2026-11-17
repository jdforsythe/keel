---
"@keel/reactive": patch
---

A throwing `onDispose` hook no longer stops a disposal: every owned node is disposed and every hook runs, then the first error in disposal order is rethrown, so a rerun never leaves an earlier effect alive beside its replacement. A rerun that throws after a hook threw rethrows the hook's error; `scope(fn)` and `run(fn)` rethrow `fn`'s error over a hook's.
