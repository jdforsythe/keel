---
"@keel/testing": minor
"@keel/schema": minor
"@keel/forms": patch
"@keel/cli": minor
"@keel/server": minor
"@keel/services": minor
"@keel/compiler": minor
"@keel/scaffold": minor
"@keel/ui": minor
"@keel/router": patch
"@keel/check": minor
---

`fire` `focus` and `blur` move focus, and the `focused` flag reports it; focusing an element a user cannot focus, or blurring one without focus, is E1719. E1703 reports `landmark-unique`. A `string` with `min` >= 1 refuses `''` and whitespace-only values as `required`; values are never trimmed, and the JSON Schema output carries `pattern: "\\S"`. `keel dev --port N` serves on N (default 5173); a port in use is one E1560 line and exit 1. An unreachable peer answers 502 `keel.unreachable`, which a `service()` caller sees as `api.network`. `KEEL_PEER_<NAME>` maps `-` in the name to `_`, and `scaffold place` takes the same deployable names as `keel build`. `Box` takes `label` (written as `aria-label`), required with `as="nav"` or `as="aside"` (E1802). E1005 names the command to run and prints after every other diagnostic.

Migration: give each `<Box as="nav">` and `<Box as="aside">` a `label`. A deployable named with `-` reads `KEEL_PEER_MY_API` where it read `KEEL_PEER_MY-API`; run `keel build` to regenerate `deploy/compose.yaml`. A stored blank value in a `min` >= 1 string no longer parses. A test that fired `focus` on an unfocusable element now fails with E1719.
