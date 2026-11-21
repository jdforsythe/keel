---
"@keel/compiler": minor
"@keel/check": minor
"@keel/cli": patch
"@keel/server": minor
---

A `topology.ts` the static read cannot take (a non-literal name, `modules` or `adapter`) is E1552 from `keel check` and `keel build`. Deployable names are lowercase letters, digits and `-`, starting with a letter; any other name is E1552 in check, build, dev and the server. E1511 is found from source when an API entry follows to a `const`, a spread or a literal computed key in the file or a relative import.

Migration: rename a deployable whose name has an uppercase letter, `_` or `.`.
