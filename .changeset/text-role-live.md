---
"@keel/ui": minor
"@keel/testing": minor
"@keel/check": patch
"@keel/cli": patch
---

`Text` takes `role` of `status` or `alert`, written as the `role` attribute: a live region for a line of copy. The render checks after a `fire` or `settle()` fail with E1826 when a `role="status"` region is inserted under an element already rendered and holds text, which a screen reader does not announce; render the region empty from the first render and change its children. `keel explain E1826` explains it, and the `keel-client` skill teaches the pattern.
