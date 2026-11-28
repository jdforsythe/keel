---
"@keel/schema": minor
---

`defect(message, { code }?)` throws a defect, an `Error` named `Defect` whose message is `<code> <message>` with a code and whose `code` is non-enumerable; `isDefect(x, code?)` recognizes only what `defect` threw. `attempt(fn, expect)` turns what `expect` recognizes into the `err` and throws anything else on as the very value; a defect never reaches `expect`. Types `Defect` and `DefectCode`.
