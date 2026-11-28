// The two-`node` topology fixture of k.e2e's serve clause (not a test file): deployables `api` (module `a`) and `web` (module `b`),
// each answering `/api/<module>/env` with its own `KEEL_SECRET`, `KEEL_ORIGIN` and `KEEL_PEER_API` (node-app.ts). Seed 1337.
import { type Tree, moduleFiles, rootFiles } from "./node-app.ts";

export const twoNodeApp = (): Tree => ({
  ...rootFiles("{ api: { modules: ['a'], adapter: 'node' }, web: { modules: ['b'], adapter: 'node' } }"),
  ...moduleFiles("a", [], { home: true }),
  ...moduleFiles("b", []),
});
