---
"@keel/compiler": patch
---

The generated client and resume entries hold `mode` as a literal from Vite's command, `"dev"` when Vite serves and `"production"` when it builds, and read no `import.meta.env`; the inspect reporter runs only under `"dev"`. The entries are `"dev"` only when Vite reports the command `serve`; a missing or other command gives `"production"`.
