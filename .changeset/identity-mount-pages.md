---
"@keel/router": minor
"@keel/testing": minor
"@keel/check": minor
"@keel/compiler": minor
"@keel/runtime-dom": patch
---

`identityMount(path)` from `@keel/router` declares the identity mount in `identity.ts`; its `href(subpath?, search?)` makes a `MountHref` under the path and throws E1582 for a subpath outside `/`-led segments of `[A-Za-z0-9._~-]`. A client router handles only the pages its table matches: a link click, `navigate` or `ok(href)` to any other path loads a document, while an initial load or a history pop of one still renders the 404. A `Form` no router matches validates its `form` handle, then lets the browser post it (`POST` only for a `MountHref`; a chosen file throws E1583; `pending()` clears on a back-forward cache restore). `renderRoute` and `resumeDocument` handles gain `documents()`, and `resumeDocument` takes an import of a module exporting `routes`. `keel check` and `keel build` report E1580 to E1582. A pre-resume submit queue no longer holds the events of an island another copy of the runtime resumed.
