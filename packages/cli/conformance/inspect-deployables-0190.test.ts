// Spec: k.inspect, clause "`keel inspect` of a document with `deployables` prints one `inspect.section` per deployable and section."
// Seed 1337. Driven through `run(['inspect', url, '--format=json'], { fetch })` with an injected fetch, as inspect-sections.test.ts.
// Assumes (k.inspect Inspect, RFC 0190): records carry `deployable`, deployables by name then sections by id; counts.sections counts those records; a document without `deployables` prints as before.
import { run } from "@keel/cli";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, parseJsonLines } from "./fixtures";

const base = { live: true, graph: { nodes: [], edges: [] }, stores: {}, ids: {}, a11y: {}, routes: {} };
const serving = (body: unknown) => ({
  cwd: "/work/app",
  fetch: (): Promise<Response> => Promise.resolve(new Response(JSON.stringify(body), { status: 200 })),
});
const name = fc.stringMatching(/^[a-z]{3,6}$/);
const sectionId = fc.stringMatching(/^[a-z]{3,6}\.[a-z]{3,6}$/);
type Doc = Record<string, { sections: Record<string, { doc: string; value: unknown }> }>;

describe("k.cli inspect deployables", () => {
  it("`keel inspect` of a document with `deployables` prints one `inspect.section` per deployable and section", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(name, { minLength: 1, maxLength: 3 }),
        fc.uniqueArray(sectionId, { minLength: 1, maxLength: 3 }),
        fc.integer(),
        async (names, ids, seed) => {
          const deployables: Doc = {};
          for (const n of names) {
            const sections: Doc[string]["sections"] = {};
            for (const id of ids) sections[id] = { doc: "d", value: `${n}:${seed}` };
            deployables[n] = { sections };
          }
          // `sections` is the union the plugin serves; the same id under every deployable is one entry there.
          const union: Record<string, { doc: string; value: unknown }> = {};
          for (const id of ids) union[id] = { doc: "d", value: "union" };
          const r = await run(
            ["inspect", "http://localhost:4000", "--format=json"],
            serving({ ...base, sections: union, deployables }),
          );
          expect(r.code).toBe(0);
          const recs = parseJsonLines(r.stdout).filter((x) => x.kind === "inspect.section");
          const sortedNames = [...names].sort();
          const sortedIds = [...ids].sort();
          expect(recs.map((x) => [x.deployable, x.id])).toEqual(
            sortedNames.flatMap((n) => sortedIds.map((id) => [n, id])),
          );
          for (const x of recs) expect(x.value).toBe(`${x.deployable}:${seed}`);
          expect(parseJsonLines(r.stdout).at(-1)?.counts).toMatchObject({ sections: names.length * ids.length });
        },
      ),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("one id under `api` and `web` prints two `inspect.section` records, `api` then `web`", async () => {
    const deployables: Doc = {
      web: { sections: { "x.y": { doc: "d", value: "page" } } },
      api: { sections: { "x.y": { doc: "d", value: "api" } } },
    };
    const r = await run(
      ["inspect", "--format=json"],
      serving({ ...base, sections: { "x.y": { doc: "d", value: "api" } }, deployables }),
    );
    const recs = parseJsonLines(r.stdout).filter((x) => x.kind === "inspect.section");
    expect(recs.map((x) => [x.deployable, x.id, x.value])).toEqual([
      ["api", "x.y", "api"],
      ["web", "x.y", "page"],
    ]);
  });

  it("a document without `deployables` prints one `inspect.section` per section, as before", async () => {
    const r = await run(
      ["inspect", "--format=json"],
      serving({ ...base, sections: { "a.b": { doc: "d", value: 1 } } }),
    );
    const recs = parseJsonLines(r.stdout).filter((x) => x.kind === "inspect.section");
    expect(recs.map((x) => x.id)).toEqual(["a.b"]);
    expect(recs.every((x) => x.deployable === undefined)).toBe(true);
  });
});
