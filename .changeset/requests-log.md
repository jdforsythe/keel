---
"@keel/testing": minor
"@keel/compiler": minor
"@keel/ctx": minor
"@keel/cli": minor
---

k.requests: every harness (`render`, `renderRoute`, `resumeDocument`) has `requests()`, the `{ method, url, headers }` of each fetch its page sent, header names only (lower case, sorted), never a value or a body; with `app` or `shell` it is that browser's own, otherwise every fetch on `ctx` while the handle is open. `@keel/ctx/internal` gains `tapNet`.
