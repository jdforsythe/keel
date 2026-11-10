---
"@keel/check": minor
"@keel/scaffold": minor
"@keel/cli": minor
"@keel/testing": patch
---

`keel check` loads Node's types into its type pass when `@types/node` resolves from the project root, and no other ambient package (rfc:0076): a node entry reading `process.env` checks clean without relying on a dependency's types. A new project lists `@types/node` and vitest 4. `keel test` and the repository reporter read vitest 4's run-end hook.
