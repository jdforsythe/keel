---
"@keel/schema": minor
---

`attempt(fn, expect)` requires `expect`: a value is `ok`, a keel `Result` the callback returns is the call's own, a throw `expect` maps to a `KeelError` is the `err`, and anything else, a defect or a value wrapping one among them, is thrown on as itself. `Result<T, E>` requires `E extends KeelError`, and `err` takes a `KeelError` only (anything else is the defect E1458). `KeelError` has an optional `cause`; `s.error(..)` gains `causedBy(cause, data)` and `in(e)`. `defect(message, { code, data, cause })`. Every schema has `parseJson(text)`, and `s.json.parseJson` takes any JSON; the issue rule `json`. `isDefect`, `isSchema` and the new `isObjectSchema` read the realm's kernel record, so no copied, spread or keyed value passes them. `Secret` has no static member.
