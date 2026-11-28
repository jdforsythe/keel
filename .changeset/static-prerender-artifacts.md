---
"@keel/compiler": patch
"@keel/server": patch
---

A `static` deployable's prerender gives its `createApp` the artifacts a `node` deployable's gets (`routes.json`, `std.json`, `schemes.json`, written beside the build entry and removed with it), so a prerendered `ThemeSelect` lists the same themes the resumed page does.
