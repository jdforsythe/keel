---
"@keel/check": minor
"@keel/cli": patch
"@keel/compiler": minor
---

`.keel/` artifact checks (backlog 0139, 0143, 0144; RFC 0055). E1005 no longer trusts `artifacts.hashes`. It always derives the expected hashes from sources, from the new `check()` option `project` (default `files`). A `.keel/` file the compiler does not write is E1005. In a workspace, `keel check` reads every `<dir>/.keel/*.json`, and compares each with the sources under `<dir>`. The file count is now the same from the root and from inside an app. `routes.json` beside a `modules/<m>/routes.ts` is W1005 (not verified) in `keel check`. `vite build` warns W1005 when it rewrites a differing `routes.json`, and `keel build` prints that line. `artifactHashes` returns `null` for `routes.json` beside a routes manifest.
