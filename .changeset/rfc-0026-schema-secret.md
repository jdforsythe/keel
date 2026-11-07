---
"@keel/schema": minor
---

k.schema Secrets (RFC 0026): `s.secret(inner)` parses to `Secret<T>`, which serializes, prints and inspects only as `"[secret]"`; decoding the marker fails with rule `secret-missing`; `reveal(secret)` is the only read path.
