---
"@keel/std-channels": minor
---

`@keel/std-channels` is a library on the format (`"keel": "library"`): its `exports` carry the `keel` condition, its `@keel/*` packages are peers, `channelRoute` lives in `channelRoute.server.ts` and the `./server` entry in `index.server.ts`, the throws the spec names (E2602, E1510, E1515) sit in `unsafe/fault.ts`, and `ChannelsConfig` is declared in `ChannelsConfig.schema.ts`. The `./module` export is removed; `module.ts` is read from the package folder.
