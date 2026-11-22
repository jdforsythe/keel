---
"@keel/ctx": patch
"@keel/compiler": patch
---

`keel dev` loads the server graph again whole when a file that registered a capability changes, whether it called `register` or `database` itself or through a helper module, and when that helper changes: the next request no longer answers 500 "capability ... is already registered".
