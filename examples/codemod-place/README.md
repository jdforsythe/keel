# codemod-place

One command moves a module to a deployable of its own. The home page in `modules/shop` shows a shelf count it asks the `stock` module for through `service({ contract: stock })`. In `topology.ts` both modules live in the `web` deployable, so the call is answered in process.

```sh
keel codemod place stock --to api --adapter node
```

The codemod adds an `api` deployable of adapter `node` holding `stock`, takes `stock` out of `web`, and writes `deploy/api/Dockerfile` and a `deploy/compose.yaml` where each deployable names the other in `KEEL_PEER_<NAME>`. It changes nothing else: no module file, no import. `keel check`, `keel test` and `keel build` pass before and after, and `keel build` then writes `dist/web/server.mjs` and `dist/api/server.mjs`. Start both, `api` with `KEEL_PEER_WEB` and `web` with `KEEL_PEER_API` naming the other's URL and one `KEEL_SECRET` in both, and the page shows the same count, now from the peer. `keel codemod place stock --to web` puts the tree back byte for byte.

`test/place.test.ts` serves the page under both topologies and finds the same text. `--dry-run` prints the edit as a diff and writes nothing.
