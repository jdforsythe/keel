---
"@keel/server": minor
---

An API route's action declares `output`: its `ok` value is parsed by `output` before any store is saved (a refused value is an E1554 `diag` naming the path and a 500 `keel.unexpected`, nothing saved), then the stores are saved, then it answers 200 `{ "ok": true, "value": <encoded> }`; a 409 `keel.conflict` sends no value, and the output's `.pii()` values join the request's scrub set. An API route's guards, loaders, live loaders and actions get `bearer`, the `Authorization: Bearer` token as a `Secret` (scheme in any letter case, one or more spaces, a token68 of 1 to 4,096 characters, else `undefined` with no error and no log line); its revealed text is scrubbed from every `diag`, the raw header is not kept, and a page's guard and loader get `undefined`. An API route's response to a request carrying `authorization` is `cache-control: no-store`, and an allowed origin's preflight allows `accept, authorization, content-type, x-keel`.
