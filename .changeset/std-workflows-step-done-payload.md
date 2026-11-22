---
"@keel/std-workflows": minor
---

`StepSpec<D, Ev>` types a step's `ok` value by its `done` event's payload schema: a payload the event refuses is a type error where the step is written, not a `failed` run. `StepSpec`'s second parameter is the chart's event map.
