---
"@keel/router": patch
"@keel/compiler": patch
"@keel/testing": patch
---

A shell's mount requests and return links are read against the mount its entry passes (`shellMount(ctx, { id, origin, mount })`, `mount` the `identity.ts` default export), not against every identity mount made in the process. The generated shell entry imports `identity.ts`'s default export and passes it. `renderRoute(id, { shell })` takes every identity mount the test's modules made.
