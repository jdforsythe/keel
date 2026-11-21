---
"@keel/std-offline": minor
---

`outbox(id, contract, opts?)` takes a module's contract from `@keel/router/contract` and sends its API write entries; `send` and `resolve` name an entry by its id after the module, and a GET, `events` or page entry does not compile. The `module` option and E2652 are removed, and an outbox builds its store on first use. The E2651 check reads a `contract` call.
