// rfc:0160 conformance: a `frame` origin equal to `KEEL_PEER_API` at `keel build` is one E1590 naming the key.
// k.origins, Frame "A `frame` origin of the app's own is E1590 in `keel build` (a `KEEL_PEER_<NAME>`, `KEEL_ORIGIN`) and `createApp` (`origin`, a URL peer); a document drops its own from `frame-src` (dev: one E1590 logged)."
// Seed 1337 (no generated input: spawned builds).
// ASSUMPTION: the E1590 record's message names the environment key, as k.origins' "naming the key" says; `KEEL_ORIGIN` is read the same way for the deployable's own origin.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { type Run, cleanup, keel, materialize } from "./compat-support.ts";
import { SLOW, build, tree } from "./origins-support.ts";

const topo = (frame: string): string =>
  `{ api: { modules: ['a'], adapter: 'node' }, w: { modules: ['c'], adapter: 'client', servedBy: 'api', origins: { frame: { '${frame}': 'r' } } } }`;
let own = "";
let other = "";
beforeAll(() => {
  own = materialize(tree(topo("https://api.test")));
  other = materialize(tree(topo("https://video.test")));
}, SLOW);
afterAll(() => {
  cleanup(own);
  cleanup(other);
});

/** `keel build` through the real binary with `KEEL_` keys of the parent removed and `env` added. */
function buildRun(dir: string, env: Record<string, string>): Run {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(process.env)) {
    if (k.startsWith("KEEL_")) {
      saved[k] = process.env[k];
      Reflect.deleteProperty(process.env, k);
    }
  }
  Object.assign(process.env, env);
  try {
    return keel(dir, ["build"]);
  } finally {
    for (const k of Object.keys(env)) Reflect.deleteProperty(process.env, k);
    for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v;
  }
}

describe("rfc:0160 conformance: an own-origin frame at keel build", () => {
  test(
    "rfc:0160 conformance: a `frame` origin equal to `KEEL_PEER_API` is one E1590 naming the key",
    () => {
      const run = buildRun(own, { KEEL_PEER_API: "https://api.test" });
      const found = run.records.filter((r) => r.kind === "diag" && r.code === "E1590");
      expect(found).toHaveLength(1);
      expect(String(found[0]?.message)).toContain("KEEL_PEER_API");
      expect(run.status).toBe(1);
    },
    SLOW,
  );
  test(
    "rfc:0160 conformance: a `frame` origin that is not a peer's builds",
    () => {
      expect(build(other, { KEEL_PEER_API: "https://api.test" })).toBe(0);
    },
    SLOW,
  );
});
