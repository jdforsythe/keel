---
"@keel/check": minor
---

`keel check` reports E1304 at a `tx` call that runs while a component builds: in the component's own body, or in a function child of `For`, `If`, `Match`, `Case` or `Boundary`. A view store starts from loader data by being created in the component with it as `initial`; the keel-server and keel-client skills say so.
