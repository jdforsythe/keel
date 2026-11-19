---
"@keel/std-statecharts": minor
"@keel/std-workflows": patch
---

A chart has `taken({ state, data }, event, payload)`, the target that event's transaction takes (a bare state name read as `{ to }`) or `undefined`; a workflow counts an entry exactly when the taken target names a `to`, so a guarded self target beside a guarded target with no `to` enters its state again when its guard holds.
