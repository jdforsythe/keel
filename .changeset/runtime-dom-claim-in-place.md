---
"@keel/runtime-dom": minor
---

Resume moves no served node: multi-item content compiles to the `frag` op, which keeps each claimed element in place and puts its text in place of the server's; `parts(node)` gives a consumer those nodes. A component returning several elements in a component slot, a resuming `For` and an `If` resuming with no branch keep the served nodes too. While `made` is on, an element placed by an op that started after it was made is recorded; an island's re-render warns E1253 ending `an element was made before its parent`. Where a component takes `children` only as a thunk, JSX children type-check as its content.
