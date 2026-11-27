---
"@keel/cli": minor
"@keel/check": minor
"@keel/compiler": minor
"@keel/scaffold": minor
"@keel/testing": minor
---

`keel check`, `keel build`, `keel test` and `keel dev` judge the tree, never the derived files on disk: each takes the derivation of the tree it runs over and rewrites each `.keel/` view and deploy file whose bytes differ (`ok check 217 files, 2 refreshed, 0 errors`; W1018 when one cannot be written). A run with `--frozen`, `CI` set or `KEEL_FROZEN=1` writes nothing and reports a differing view as E1005. `routes.json` and `surface.json` come from one evaluation, cached in `node_modules/.cache/keel/derived/` while every file it loaded is unchanged; the json summary's `counts` hold `refreshed`, `evaluated` and `cached`. `surface.json` is version 3 with no `sources`; `--base` reads versions 2 and 3. Only `surface.json` and the deploy files are committed; a scaffolded `.gitignore` lists the other views. `keel pack --frozen` replaces `keel pack --check`. W1005 is reserved and never reported.
