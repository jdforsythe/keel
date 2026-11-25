---
"@keel/testing": patch
---

A failed test's T0001 from `testResults` carries in its `fix` the failure's first line when the 89-character message cut it, and for a fast-check failure its seed and path, shrunk counterexample, shrink count and error line, each at most 512 characters, so `keel test` prints what replays a failed property.
