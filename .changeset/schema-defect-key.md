---
"@keel/schema": minor
---

A defect is marked by the own key `Symbol.for('keel.defect')`, so a defect of any copy of `@keel/schema` is `isDefect`; `attempt`'s `expect` never sees a value wrapping a defect through `cause` or `errors`. `isSchema(x)`, a key guard.
