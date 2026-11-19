---
"@keel/runtime-dom": minor
"@keel/router": patch
---

Every component body and op child is built untracked (k.component Build): a reactive read while it is built is its value at build and re-renders nothing; bindings, `computed`s, `effect`s and each op's own input update. The router renders the committed page as a row keyed by its view, so revalidation keeps the page and updates `data` through its bindings. A hand-built `For` takes `each` as a getter and keys its rows by item object.

Migration: a component that read a signal, a store or `props.data` at its top level and relied on its page re-rendering now shows the value at build; read it in a binding (`{props.data.count}`) or wrap the derived value in `computed`.
