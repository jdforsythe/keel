---
"@keel/store": minor
---

`restore` of a snapshot whose log names a transaction the store no longer declares, or holds a payload its schema refuses, returns `ok`: it keeps `state` and `head`, takes `state` as `initial` and keeps no entry. A state the schema refuses, or an entry of the wrong shape, stays `err`.
