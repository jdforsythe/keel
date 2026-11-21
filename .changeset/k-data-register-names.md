---
"@keel/check": minor
"@keel/compiler": minor
---

`keel check` reports E1607 at a `register` call of `@keel/ctx` in a file under `modules/<id>/` whose name is not a string literal `<id>.<name>` with `<name>` one lowerCamel segment, and at a name another app file of the project registers too, in the file whose path sorts later; `explain('E1607')` describes it. In `keel dev`, editing an app file that calls `@keel/ctx`'s `register` or `@keel/std-postgres`'s `database` loads the server graph again whole, so the file registers again with no E1602.
