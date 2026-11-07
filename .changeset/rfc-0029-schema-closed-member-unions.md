---
"@keel/schema": minor
"@keel/ui": patch
"@keel/forms": patch
"@keel/cli": patch
---

k.schema closed objects and member unions (RFC 0029): `s.object(shape, { closed: true })` fails undeclared keys with rule `unknown-key`; `s.union([a, b, ...])` accepts with the first accepting member and reports the last member's issues; JSON Schema `anyOf`. ui `TokenSchema` is now a closed `s.object` with string-or-pair colors.
