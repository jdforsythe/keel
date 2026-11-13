---
"@keel/ctx": minor
"@keel/server": minor
"@keel/cli": patch
---

The `save` observer event is `{ kind: 'save', store, head, from }`: `from` is the store's head before the save (0 when nothing was saved before). The cli's `Input` type has `out` for a std command's `--out`.
