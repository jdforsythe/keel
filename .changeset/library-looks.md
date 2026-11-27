---
"@keel/ui": minor
"@keel/check": minor
"@keel/compiler": minor
"@keel/server": minor
"@keel/cli": minor
---

k.looks: a library ships `<id>Tokens` from its `./tokens` entry and an app spreads it into `tokens.ts` (E1810 with its fix, E1811, E1812, E1813); a library's names are `<id>.<name>`, `--k-<group>-<id>-<name>` in CSS. `tokens.ts` evaluates with the `keel` condition, and a library's own folder keeps its `package.json` when read as installed.
