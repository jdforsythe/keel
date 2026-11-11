---
"@keel/check": minor
"@keel/scaffold": minor
---

`keel check` reports E1566 for a bad `host` in `topology.ts`, and `keel explain` covers E1565, E1566 and W1567. The generated CI job of a `node` deployable that hosts a `client` also runs when that client's modules change.
