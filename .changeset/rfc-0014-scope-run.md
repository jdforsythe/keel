---
"@keel/reactive": minor
"@keel/runtime-dom": patch
---

rfc:0014: `Scope.run(fn)` runs `fn` with that scope as owner, untracked (writes still checked), returning its value; E1206 on a disposed scope. runtime-dom drops the nursery: structural ops create rows and branches with `scope.run`, so no idle effect node accumulates per commit.
