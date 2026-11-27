// failedDist (k.api Rules): the dist/<name> folders a build failing with E1510 or E1511 leaves none of. Seed 1337.
import type { Topology } from "@keel/compiler";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { failedDist } from "../src/internal/failedDist.ts";

const SEED = 1337;
const TOPOLOGY: Topology = {
  api: { modules: ["a", "b"], adapter: "node" },
  web: { modules: ["c"], adapter: "client" },
};
const diag = (code: string, message: string, path = "topology.ts") => ({ kind: "diag", code, message, path });

const MODULES = ["a", "b", "c", "d", "e"] as const;
const ADAPTERS = ["node", "client", "static"] as const;
const NAMES = ["api", "web", "site", "ops"] as const;
const topologies = fc
  .uniqueArray(fc.constantFrom(...NAMES), { minLength: 0, maxLength: 4 })
  .chain((names) =>
    fc.tuple(
      ...names.map((n) =>
        fc.record({
          name: fc.constant(n),
          modules: fc.uniqueArray(fc.constantFrom(...MODULES), { maxLength: 3 }),
          adapter: fc.constantFrom(...ADAPTERS),
        }),
      ),
    ),
  )
  .map((ds): Topology => Object.fromEntries(ds.map((d) => [d.name, { modules: d.modules, adapter: d.adapter }])));
const serving = (t: Topology, m: string) =>
  Object.entries(t)
    .filter(([, d]) => d.modules.includes(m))
    .map(([n]) => `dist/${n}`)
    .sort();

describe("failedDist", () => {
  it("for any topology and failing entry, names exactly the deployables serving the entry's module", () => {
    fc.assert(
      fc.property(
        topologies,
        fc.constantFrom(...MODULES),
        fc.stringMatching(/^[a-z]{1,8}$/),
        fc.constantFrom("E1510", "E1511"),
        (t, m, key, code) => {
          const want = serving(t, m);
          expect(failedDist([diag(code, `${m}.${key}: local takes the literal true`)], t)).toEqual(want);
          expect(
            failedDist([diag(code, "a contract entry is of no kind", `modules/${m}/${m}.contract.ts`)], t),
          ).toEqual(want);
        },
      ),
      { seed: SEED },
    );
  });

  it("removes none for an entry no deployable serves, as after a good build of api, web and site", () => {
    const t: Topology = {
      web: { modules: ["front"], adapter: "node" },
      api: { modules: ["greet"], adapter: "node" },
      site: { modules: ["app"], adapter: "static" },
    };
    const r = diag("E1510", "lone.tools: local takes the literal true", "modules/lone/lone.contract.ts");
    expect(failedDist([r], t)).toEqual([]);
  });

  it("names the deployable an E1511 message names", () => {
    const r = diag("E1511", "c.tools: local route in client deployable web, which has no server");
    expect(failedDist([r], TOPOLOGY)).toEqual(["dist/web"]);
  });

  it("names none when no module is found, and none for other codes or records", () => {
    fc.assert(
      fc.property(fc.string(), (message) => {
        expect(failedDist([diag("E1510", ` ${message}`, "elsewhere.ts")], TOPOLOGY)).toEqual([]);
        expect(failedDist([diag("E1502", message), { kind: "summary", code: "E1510", message }], TOPOLOGY)).toEqual([]);
      }),
      { seed: SEED },
    );
  });
});
