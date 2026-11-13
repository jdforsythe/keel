---
"@keel/check": minor
---

E1576 (k.security): `keel check` reports a `@keel/*` internal entry (a specifier with an `internal` path segment) named by an import, type-only included, a re-export, or a literal `import()` or `require()` in any code file outside `packages/`, `node_modules/` and `.keel/`, tests and `unsafe/` included. No fix: the public replacement is the author's. E1251 reads specifiers through the same walk.
