---
"@keel/compiler": minor
"@keel/cli": minor
---

k.cli Inspect: under `keel dev` of a topology with a `node` deployable, `GET /__keel/inspect` holds `deployables`, `{ [name]: { sections } }`, each deployable's own sections (the page's dev entry posts its deployable's name); `sections` is their union, a `node` deployable's replacing the page's and the first by name kept. `keel inspect` prints one `inspect.section` per deployable and section, carrying `deployable`.
