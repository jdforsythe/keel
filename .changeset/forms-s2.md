---
"@keel/forms": minor
---

`form(schema, { issueText })`: a field's error text for each `FieldIssue` `{ rule, path, min?, max?, values?, format? }` (`path` dotted); without it the English text applies, `Invalid value` for rule `format`. A field validated on blur sees only its own issues. A format field reads and writes as its base type (`Field<number>` for `Format<number, N>`).
