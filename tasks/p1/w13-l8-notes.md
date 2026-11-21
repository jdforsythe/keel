# W13 L8 (std-health, std-channels, std-sessions): what it leaves for others

Branch `w13-l8`, built; a follow-up on the branch settles the four design points below before it merges into `lane-r157`.

## Result
std-health: `./contract`, `routes = manifest(health, {...})`. std-channels: `channelEntries` and `channelRoute`, a failing `params` answers 422, the stream on an `events: true` entry. std-sessions: `./contract`; replay, minimize, redact, `commandJob` and `toTest` read pages from the public contracts and join modules with `routeTable`; `monitorRoutes` binds a `sessionsTally` contract. Red list (failing files, type errors): sessions 48, 108 to 14, 6; channels 12, 46 to 12, 14 (all twelve from one fixture defect); health 2, 1 to 0, 0; messages 2, 1 to 1, 1. Unit: channels 35 of 35, health 18 of 18, sessions 296 pass and 29 fail (a conformance fixture they share). `unsafe` unchanged, no S0012.

## Design points for the follow-up
1. The lane changed `packages/router` (2be10515): `manifest` accepts a handler declared through another contract of the same module that holds the identical entry object, because `channelRoute(channel, {...})` as the RFC writes it never sees the app's contract. Preferred: `channelRoute` takes the module's contract as every handler constructor does, and the router change is reverted.
2. std.contracts and std.channels say `output: s.null()` and "answers `ok(null)`": there is no `s.null()`; the build uses `s.object({})` and `ok({})`.
3. The RFC is silent on std-sessions' `monitorRoutes`: as a second table of module `sessions` it is E1502 beside `routes`, and placement never reaches it.
4. E1513 (L6) fires on a `contract()` call inside a package's handler helper.

## For the conformance-writer
- std-channels `fixtures.ts:183,255`: `post` is declared twice, so all twelve files fail to transform; rename the entry helper and make its body generic.
- std-sessions `fixtures.ts:45,61,113,253`: `cartContract.hrefcartContract2` (a broken edit) and `cartContract` used out of scope: hoist it to module scope. `E2003-replay-input:17` and `rfc0169-replay-e2003-recorded:15` call `cartRoutes().href`. `host-emit-replay:27` uses the one-argument `manifest`. `fixtures/cart-bug/modules/cart/routes.ts` needs a `cart.contract.ts` exporting `cart`. `contract-export:31-41`: the guard runs before the query is decoded (k.api), so the request is 403, not 422: give it a reader.
- std-messages `client-chunks:114-136`: `appContract` is not defined in `routes.ts`. `server-only:43`: a `locale: string` annotation is a type error.
