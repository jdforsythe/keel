---
"@keel/reactive": patch
---

A throwing `equals` is the computed's throw, like one from its `fn`, so its readers see it and later writes still rerun them. A throw while a commit brings a node's sources up to date (a scope's `onDispose` hook) still reruns that node and is rethrown after it, so no effect is left waiting for a write that never reaches it.
