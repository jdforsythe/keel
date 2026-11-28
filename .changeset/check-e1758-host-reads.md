---
"@keel/check": patch
---

E1758 reports a local-time getter or `toString` on a date bound to a const, `String` of a date or a template holding one, `new Date` of local date parts, `new Date` or `Date.parse` of a date-time string without an offset, `toLocaleUpperCase`/`toLocaleLowerCase` without a locale, a locale method through `.call`, and a locale argument of `void 0` or `[]`.
