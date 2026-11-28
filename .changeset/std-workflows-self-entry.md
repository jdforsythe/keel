---
"@keel/std-workflows": patch
---

A step or wait whose event leads back to its own state is entered again: `entered` rises and `attempt` resets, so the next job key is new and the step runs once per entry. A target with no `to` stays in the entry.
