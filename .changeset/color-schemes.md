---
"@keel/ui": minor
"@keel/check": minor
"@keel/compiler": minor
"@keel/server": minor
---

k.schemes: `tokens.ts` takes `schemes`; the CSS follows the system preference until `data-k-scheme` on `<html>` overrides it and declares `color-scheme`; `SchemeSelect` writes the `keel-scheme` cookie; a `node` document renders the pick from `schemes.json`, and a `client` or `static` document that offers the choice loads a 300-byte external script first; contrast and the focus ring are judged per declared scheme (E1814 for `SchemeSelect` with one scheme).
