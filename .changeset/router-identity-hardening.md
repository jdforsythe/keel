---
"@keel/check": minor
"@keel/compiler": minor
"@keel/server": minor
"@keel/router": patch
"@keel/testing": patch
"@keel/std-messages": minor
---

E1593: an `identityMount` call in a non-test project file other than `identity.ts`'s default export is an error at the call; only that default export reaches the router and a shell. `keel explain E1593` is new. E1579 also refuses a `handle.path` at or under `/assets`, as a literal or as `identity.ts`'s `.path`, in `keel check`, `keel build` (`handle.path <p> is at or under /assets (built files)`) and `createApp` (`identity handle.path: lowercase / segments, not /assets, no route under it`). A served document's `#k-state` carries `title`, the deployable's name, and the client router takes its fallback title from it, so an untitled page after resume shows the deployable's name. A `renderRoute` handle's `navigate` rejects with the router's E1501 for a value it refuses. `Set.text` parses its entry with the set, so a locale file the set refuses throws however it is imported.
