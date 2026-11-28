---
"@keel/testing": patch
---

`serve` waits the whole 20 s readiness bound for a deployable's first answer to `GET /`: a first answer slower than 5 s is awaited, and a refused or reset connection is asked again, instead of the start failing E1737 `no HTTP answer` at the bound.
