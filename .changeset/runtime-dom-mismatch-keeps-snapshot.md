---
"@keel/runtime-dom": patch
---

An island whose claim mismatches gives back the `#k-state` snapshots its stores took, so the stores its client re-render creates start from the served state.
