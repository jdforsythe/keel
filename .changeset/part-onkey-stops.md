---
"@keel/ui": patch
---

A key a part's `onKey` handles (returns true) is default-prevented and stops there: an ancestor part's `onKey` does not see it, so Escape in a Menu inside a Dialog closes only the Menu.
