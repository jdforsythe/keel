---
"@keel/services": minor
---

`service({ contract, timeout? })` takes a module's contract from `@keel/router/contract` and has one method per API entry, named by the entry's id after the module; `service({ module, schema })` is removed. `ContractClient` types it.
