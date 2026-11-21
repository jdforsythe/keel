---
"@keel/cli": minor
"@keel/check": minor
"@keel/scaffold": minor
---

`keel review [<base>..<head> | --all]` lists each escape from the framework's protections as a `review` record ranked by danger and novelty, with the baseline `keel-review.json` read at the range's base and `--accept <id> --reason <text>` to add an entry (k.review, k.escapes). `keel explain` covers the 26 R codes and E1067 to E1070. The generated CI workflow gains a `review` job on pull requests. The `keel-escapes` skill reads the command's output. `keel ledger` counts a standalone app's `unsafe(` calls in its `modules/`.
