---
"@keel/ctx": minor
"@keel/reactive": patch
"@keel/store": minor
"@keel/runtime-dom": patch
"@keel/router": minor
"@keel/server": patch
"@keel/forms": patch
"@keel/testing": minor
"@keel/cli": minor
"@keel/compiler": minor
"@keel/check": minor
---

Kernel additions for std.sessions (RFC 0070). k.ctx: `observe(ctx, fn)` receives `nav`, `fire`, `resource` and `error` events from the router, runtime-dom, `Match` and `Boundary` (password values and one-character keys arrive as `x`; kernel focus moves are not reported), and `seedOf(ctx)` returns the `createCtx` seed. k.store: `stores()` is reactive and a store exposes `payloads`. k.router: guards receive `caller` (the server's caller hash, `""` anonymous, the router's or harness's `caller` option). k.testing: `renderRoute` takes `caller` and its handle has `navigate(href)`; `TestEvent` is an alias of k.ctx `FireEvent`. k.cli: `stdCommand('session', op)` fills the reserved `session` command, and `Io.fetch` takes `init`. k.module: `importDeps` also loads a package's `./tools` export, and `clientStd(pkg, keys)` sends only the named config keys to the browser. k.check: a rule receives the project's code files and `topology.ts` as `project`.
