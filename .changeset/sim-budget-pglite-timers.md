---
"@keel/std-postgres": patch
"@keel/testing": patch
---

k.drive: PGlite's statements run in an async context of their own, so a timer Postgres arms inside PGlite (its 10 s statistics flush) is never work of a `simulate` run that sent the statement through a server on a ctx the run does not drive. A budget spent while `simulate` shrinks a failing run ends the shrinking: the smallest failing run found so far is thrown with its own error, labelled `shrunk until the budget ran out`, not E1728.
