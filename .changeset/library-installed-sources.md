---
"@keel/compiler": patch
"@keel/testing": patch
"@keel/cli": patch
---

An app's `keel test` evaluates `tokens.ts` the way `keel check` and `keel build` do (`projectTokens`), so a library installed from its tarball, whose `./tokens` entry names a `.ts` file under `node_modules`, no longer fails every render with E1807; `projectTokens` imports its bundle as a `data:` URL, so it runs under any loader. A placed library's `./routes` and `./contract` resolve to their `keel` targets on every surface (`keelExportOf`), and the evidence's contrast table reads the evaluated tokens.
