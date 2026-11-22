# compose-peers

Two `node` deployables as peers, with the signed-in user carried from one to the other. In `topology.ts`, `web` serves the home page in `modules/front` and `api` serves `GET /api/hello` in `modules/greet`. The page's loader calls `greetApi.hello({ user }, ctx)`, a `service({ contract: greet })` client, and `web` reaches `api` at the URL in `KEEL_PEER_API`.

The person signs in at `web` only. `identity.server.ts` stands in for an auth proxy: it reads `x-forwarded-user`, which the proxy in front of `web` sets. The call to `api` carries that user in an `x-keel-user` header signed with `KEEL_SECRET`, so `api` uses it as `user` and runs no `identify`; a header it did not sign is ignored and the greeting is refused with 403. Both deployables need the same `KEEL_SECRET`.

`test/peers.test.ts` runs both deployables over sim ctxs, `web` calling `api` by URL. Run `keel check`, `keel test` and `keel build`; `deploy/compose.yaml` starts both, each naming the other in `KEEL_PEER_<NAME>`. By hand, each server needs the other's URL: `PORT=8091 KEEL_PEER_WEB=http://127.0.0.1:8092 node dist/api/server.mjs` and `PORT=8092 KEEL_PEER_API=http://127.0.0.1:8091 node dist/web/server.mjs`, both with one `KEEL_SECRET` of 32 bytes or more.
