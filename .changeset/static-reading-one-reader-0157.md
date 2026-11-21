---
"@keel/compiler": minor
"@keel/check": minor
---

One static reading of a contract for `routes.json` and E1111 (k.contract Static reading): `readContract` in `@keel/compiler/internal`. The entries and each entry are object literals in the call, and `method`, `path`, `layout` and `events` literals written in place; a name, call, spread (a const object literal's included) or computed key there, or a non-literal one of those members, is W1005 named by its source and E1111 at it, and the entries beside it are still read. Any unread part of a contract opens `routes.json`'s id set.
