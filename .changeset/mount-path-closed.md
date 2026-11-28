---
"@keel/router": patch
"@keel/compiler": patch
"@keel/server": patch
"@keel/testing": patch
---

`identityMount` throws E1580 for a `path` that is not lowercase `/` segments, so no mount resolves off-origin. `createRouter` takes `mount`, the identity mount's `path`: that router matches no page at or under it, so a link, `navigate` or an action's `ok` there is a document navigation even where a `:param` route would fit. A project with `identity.ts` starts its router with it; `createApp` matches no page under `handle.path`; `renderRoute` takes `mount` as well. A path holding a `\` matches no page. `settle`'s "fire did not settle" names its bound, 200000 macrotask turns.
