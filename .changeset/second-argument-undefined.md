---
"@keel/runtime-dom": minor
"@keel/testing": minor
---

A component's second argument is `undefined` in `Component`, `Island` and `TestComponent` (k.component); a named slot is a prop whose value is a function returning JSX. `Slots` is `undefined`. The runtime, the router and the harness call every component with `undefined` there.
