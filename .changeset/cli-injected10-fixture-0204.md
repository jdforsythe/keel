---
"@keel/cli": patch
---

The injected-10 budget conformance test builds its fixture copy under the OS temp directory instead of `apps/`, so an interrupted run no longer leaves a duplicate workspace that blocks turbo (backlog 0204).
