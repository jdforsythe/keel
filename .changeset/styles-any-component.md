---
"@keel/compiler": minor
---

Part styles are collected from the literal `styles` of any component that is not a base element or `Part`. A `styles` value, part or spread that is not an object literal is E1823 (no fix), except the enclosing component's own `props.styles` or a member of it, whose literal is collected where its caller writes it.
