// Spec: k.topology, clause "Under `keel dev` of a `client` deployable `web` and a `node` deployable `api` whose page and app both serve section `x`, the inspect document's `sections.x` is `api`'s and `deployables.web.sections.x` and `deployables.api.sections.x` are each its own."
// Seed: 1337 (the page's value is generated; one dev process serves every run). Section `x` is `a.x`, registered by module `a` of `api`; the page of `web` posts `{ graph, stores, sections, deployable: "web" }` to `/__keel/inspect` with its own `Origin`.
// Also (k.inspect, the `deployables` of `keel dev`): "`sections` is their union": a section only the page serves is in `sections` and in `deployables.web` alone; `deployables.api` holds none of the page's.
// Untestable here, one line: "of two `node` deployables, the first by name is kept" needs two `node` deployables serving different values for one id, and the inspector registry is process-global in one dev process, so both serve the same value.
import fc from "fast-check";
import { afterAll, beforeAll, expect, test } from "vitest";
import { cleanup } from "./boundary-support.ts";
import { ID, SERVED, type Dev, at, devTree, document, materialize, post, startDev } from "./dev-inspect-support.ts";

const SLOW = 180_000;
let dir = "";
let dev: Dev | undefined;
beforeAll(async () => {
  dir = materialize(devTree());
  dev = await startDev(dir);
}, SLOW);
afterAll(() => {
  dev?.stop();
  if (dir !== "") cleanup(dir);
});
const live = (): Dev => {
  if (dev === undefined) throw new Error("fixture: keel dev not started");
  return dev;
};

test(
  "under `keel dev`, `sections.x` is `api`'s and `deployables.web.sections.x` and `deployables.api.sections.x` are each its own",
  async () => {
    const d = live();
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]{3,12}$/), async (word) => {
        const page = `from-web-${word}`;
        expect(await post(d, "web", { [ID]: { doc: "x", value: page } })).toBeLessThan(300);
        const doc = await document(d);
        expect(at(doc, "sections", ID, "value")).toBe(SERVED);
        expect(at(doc, "deployables", "api", "sections", ID, "value")).toBe(SERVED);
        expect(at(doc, "deployables", "web", "sections", ID, "value")).toBe(page);
      }),
      { seed: 1337, numRuns: 8 },
    );
  },
  SLOW,
);

test(
  "`sections` is the union: a section only the page serves is in `sections` and in `deployables.web` alone",
  async () => {
    const d = live();
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: -1000, max: 1000 }), async (n) => {
        expect(await post(d, "web", { "w.only": { doc: "o", value: n }, [ID]: { doc: "x", value: "p" } })).toBeLessThan(
          300,
        );
        const doc = await document(d);
        expect(at(doc, "sections", "w.only", "value")).toBe(n);
        expect(at(doc, "deployables", "web", "sections", "w.only", "value")).toBe(n);
        expect(at(doc, "deployables", "api", "sections", "w.only")).toBeUndefined();
      }),
      { seed: 1337, numRuns: 8 },
    );
  },
  SLOW,
);
