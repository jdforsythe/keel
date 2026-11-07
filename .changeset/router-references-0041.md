---
"@keel/router": minor
"@keel/ui": minor
"@keel/server": minor
"@keel/testing": patch
---

RFC 0041: `guard({ redirect }, fn)` replaces `guard(name, { redirect }, fn)`; routes hold the value (`guard: auth`); `guardTable` and `createApp({ guards })` are removed; routes.json `guard` is the guard's `redirect`; E1506 covers layouts only. `manifest()` returns `routes.href(id, params?, search?)` typed from the manifest; the free `href` export is removed (in an action, bind `const to: Href = routes.href(...)` before `ok(to)`). `RouterHistory.push/replace(url, key)` and `onPop(fn(url, key?))`: scroll is restored per history entry. `Image src` is an asset URL `string` (no E1501 for `src="logo.png"`).
