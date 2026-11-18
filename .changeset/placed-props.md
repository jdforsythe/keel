---
"@keel/compiler": minor
"@keel/runtime-dom": minor
"@keel/server": minor
"@keel/check": minor
---

A call of a member of a component's first parameter alone in a JSX child, `{props.icon()}` or left of `??`, is a slot call: what it returns is placed as content, once, and resumes in place; a slot or multi-item content given an array places its items in order. A text binding whose value is a node, an array holding one, or a function renders `''` and never a function's source; in `'dev'` mode the client warns once per binding and a dev `createApp` logs one `diag` E1406 per route. The check's type pass reports E1406 for a JSX child bound as text whose type holds a node or is a function, with a fix appending `()` to a prop member or name that takes no argument.
