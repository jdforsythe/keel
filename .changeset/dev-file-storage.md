---
"@keel/ctx": minor
"@keel/compiler": patch
---

`keel dev` gives each `node` deployable its own `ctx.storage` in `.keel-dev/<name>.storage.json`, so modules using storage answer and keep their writes across dev restarts with a plain `node`. `createCtx({ storage })` backs `ctx.storage` in real and shell modes; `@keel/ctx/node` exports `fileStorage(path)`, a JSON-file `KeyValueStorage` for development and single-process use; a missing file is empty, and a file that cannot be read or parsed rejects naming the file (never its contents) and is never overwritten. Where the runtime has no `localStorage` and no `storage` is given, `ctx.storage` rejects naming `--experimental-webstorage --localstorage-file=<path>` and the `storage` option.
