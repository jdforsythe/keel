// Spec: k.inspect, clause "`keel inspect` prints one `inspect.section` per section; an `error` one is E1057, exit 1."
// k.inspect Inspect
// Also: summary counts sections; an absent `sections` key is read as `{}` (the plugin's document has none).
// Driven through `run(['inspect', url, '--format=json'], { fetch })` with an injected fetch. Seed 1337.
import { run } from "@keel/cli";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, parseJsonLines } from "./fixtures";

const CWD = "/work/app";
type Section = { doc: string; value: unknown } | { doc: string; error: string };
const base = {
  live: true,
  graph: { nodes: [], edges: [] },
  stores: {},
  ids: {},
  a11y: {},
  routes: {},
};
const serving = (body: unknown) => ({
  cwd: CWD,
  fetch: (): Promise<Response> => Promise.resolve(new Response(JSON.stringify(body), { status: 200 })),
});
const sectionId = fc.stringMatching(/^[a-z]{3,6}\.[a-z]{3,6}$/);
const docText = fc.stringMatching(/^[A-Za-z ]{1,20}$/);
const json = fc.jsonValue();

describe("k.cli inspect sections", () => {
  it("`keel inspect` prints one `inspect.section` per value section, sorted by id, carrying id, doc, value", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(fc.tuple(sectionId, docText, json), { selector: (t) => t[0], maxLength: 5 }),
        async (rows) => {
          const sections: Record<string, Section> = {};
          for (const [id, doc, value] of rows) sections[id] = { doc, value };
          const r = await run(["inspect", "http://localhost:4000", "--format=json"], serving({ ...base, sections }));
          expect(r.code).toBe(0);
          const recs = parseJsonLines(r.stdout).filter((x) => x.kind === "inspect.section");
          const expected = [...rows].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
          expect(recs.map((x) => x.id)).toEqual(expected.map((t) => t[0]));
          expect(recs.map((x) => x.doc)).toEqual(expected.map((t) => t[1]));
          expect(recs.map((x) => x.value)).toEqual(expected.map((t) => t[2]));
        },
      ),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("an `error` section is an E1057 diag and the exit code is 1", async () => {
    await fc.assert(
      fc.asyncProperty(fc.uniqueArray(sectionId, { minLength: 1, maxLength: 4 }), docText, async (ids, doc) => {
        const sections: Record<string, Section> = {};
        for (const id of ids) sections[id] = { doc, error: "E1057 value failed schema" };
        const r = await run(["inspect", "http://localhost:4000", "--format=json"], serving({ ...base, sections }));
        expect(r.code).toBe(1);
        const recs = parseJsonLines(r.stdout);
        const diags = recs.filter((x) => x.kind === "diag" && x.code === "E1057");
        expect(diags.length).toBeGreaterThanOrEqual(1);
        expect(recs.filter((x) => x.kind === "inspect.section")).toEqual([]);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("a mix of value and error sections: values print as inspect.section, errors as E1057, exit 1", async () => {
    const sections: Record<string, Section> = {
      "a.good": { doc: "Good", value: { n: 1 } },
      "b.bad": { doc: "Bad", error: "E1057 boom" },
    };
    const r = await run(["inspect", "--format=json"], serving({ ...base, sections }));
    expect(r.code).toBe(1);
    const recs = parseJsonLines(r.stdout);
    expect(recs.filter((x) => x.kind === "inspect.section").map((x) => x.id)).toEqual(["a.good"]);
    expect(recs.filter((x) => x.kind === "diag" && x.code === "E1057")).toHaveLength(1);
  });

  it("the summary's counts.sections is the number of sections", async () => {
    await fc.assert(
      fc.asyncProperty(fc.uniqueArray(sectionId, { maxLength: 5 }), fc.nat(5), async (ids, nErr) => {
        const sections: Record<string, Section> = {};
        ids.forEach((id, i) => {
          sections[id] = i < nErr ? { doc: "d", error: "E1057 x" } : { doc: "d", value: i };
        });
        const r = await run(["inspect", "--format=json"], serving({ ...base, sections }));
        const last = parseJsonLines(r.stdout).at(-1);
        expect(last).toMatchObject({ kind: "summary" });
        expect(last?.counts).toMatchObject({ sections: ids.length });
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("an absent `sections` key is read as `{}`: no inspect.section records, counts.sections 0, exit 0", async () => {
    const r = await run(["inspect", "--format=json"], serving(base));
    expect(r.code).toBe(0);
    const recs = parseJsonLines(r.stdout);
    expect(recs.filter((x) => x.kind === "inspect.section")).toEqual([]);
    expect(recs.at(-1)?.counts).toMatchObject({ sections: 0 });
  });
});
