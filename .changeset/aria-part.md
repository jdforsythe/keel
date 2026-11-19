---
"@keel/ui": minor
"@keel/check": minor
"@keel/runtime-dom": patch
---

`@keel/ui/aria` exports `Part`, the one element stdlib widgets are built from: `role` fixes the tag and the ARIA props it takes (`PartProps`, a union discriminated by `role`), with `focus`, `onKey(KeyInput)`, `activeDescendant` highlighting and a modal `dialog` (k.aria). `check` reports E1822 for `@keel/ui/aria` in app code. The runtime binds `cancel` and `close` directly on the element, as it binds the other non-bubbling events.
