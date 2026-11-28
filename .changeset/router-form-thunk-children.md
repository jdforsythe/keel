---
"@keel/router": minor
---

`Form` takes `children` only as a thunk, `() => Node | readonly Node[] | string`, so its content is made inside the form; JSX `<Form>` children compile to one.
