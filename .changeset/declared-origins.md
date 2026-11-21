---
"@keel/compiler": minor
"@keel/server": minor
"@keel/ui": minor
"@keel/check": minor
"@keel/cli": minor
"@keel/scaffold": minor
---

A deployable may declare third-party origins in `topology.ts`: `origins: { img?, media?, font?, connect?, frame? }`, each an exact origin mapped to a reason. Declared origins widen the content security policy for their directive in documents, `csp.txt`, a hosted client's `index.html` and the native shell policies, and nothing else does (E1590 malformed, E1591 repeated). `keel check` does not report E1570 or E1571 for a URL at a declared origin. `@keel/ui` adds `Frame`, a sandboxed `iframe` with a required `title` (E1802). `keel evidence` lists the declared origins in `security.json`.
