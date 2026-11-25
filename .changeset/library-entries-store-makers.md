---
"@keel/check": minor
---

E1151 does not judge an import of a subpath a package's `exports` write whole (`@<scope>/<name>/server`, `/tools`); `public.exports` judges files. E1107 judges a library's store maker (a function whose `store` state is its caller's schema) at each call, read at the argument paths its state takes; `s.enum` and `s.literal` arguments are values, not read.
