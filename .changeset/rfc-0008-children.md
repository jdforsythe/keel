---
"@keel/compiler": minor
"@keel/ui": minor
"@keel/runtime-dom": patch
---

rfc:0008: JSX children of a component are delivered as `props.children`, a `() => Node | string` thunk, instead of a `default` slot. Base elements accept a `Children` thunk or plain children. `Slots` is reserved for named slots.
