---
"@keel/testing": patch
---

`open(path, { hold: true })` lets a classic external script with neither `async` nor `defer` run as the parser reaches it, so a held `client` or `static` document whose head loads the scheme script is parsed and shown; every other script still waits for `resume()`.
