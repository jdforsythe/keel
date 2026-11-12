---
"@keel/runtime-dom": minor
"@keel/reactive": patch
"@keel/ui": minor
"@keel/compiler": minor
"@keel/check": minor
---

A keyed `For` row keeps its nodes when `each` changes: its bindings update from the new item, a top-level read of the item re-renders nothing, and an insert or removal moves no other row, so focus, selection and input state survive a refresh. Every `@keel/ui` control binds each prop it is given as a getter (`as` and `level` choose the tag and are read once). A top-level `const` that reads only props and is used in a JSX expression outside any function is E1405, with a fix that reads the prop in the binding.

Migration: run `keel check` and apply the E1405 fixes; a component that read a prop once into the DOM showed a stale value in a kept row.
