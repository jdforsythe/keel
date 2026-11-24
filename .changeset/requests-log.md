---
"@keel/testing": minor
"@keel/compiler": minor
"@keel/ctx": minor
"@keel/cli": minor
---

k.requests: every harness (`render`, `renderRoute`, `resumeDocument`) has `requests()`, the `{ method, url, headers }` of each fetch its page sent, header names only (lower case, sorted), never a value or a body; with `app` or `shell` it is that browser's own, otherwise every fetch on `ctx` while the handle is open. `renderRoute` loses its `mount` option: without `user` or `app` its router reads `/__keel/user` exactly when the test file's module graph made an identity mount, the first one made its `mount`, and under vitest the `keel()` plugin loads the project's `identity.ts` before each test file, as the built entry imports it. `@keel/ctx/internal` gains `tapNet`.
