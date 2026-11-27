---
"@keel/compiler": minor
---

k.server-deps: a bundled package file's literal `../` read inside its package is copied into `dist/<name>/` without its leading `../`, and the bundle reads the copy; a read outside the package is E1014 `reads <f>, outside its package`.
