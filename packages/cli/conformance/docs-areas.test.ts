// Spec: k.docs, clause "With `map.json` areas `a` (sections `k.x` then `k.y`) and `b` (`k.z`), `keel docs a` emits `docs.area` `{ id: \"a\", sections: 2 }`, then the `docs.entry` of `k.x`, then of `k.y`, each with its `holds`, and nothing of `k.z`; compact prints `k.x <title> <package>: <holds>`."
// Spec: k.docs, clause "`keel docs zz` for an area `map.json` lacks emits E1052, exit 2."
// Seed 1337 (the order property). Red: `docs` is absent (E1051).
// Not conformance: D0019 to D0021, the `map.json` and `glossary.json` shapes and the budgets are tooling checks (`tooling/test/docs-pack.test.ts`).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, cliPkg, jsonRecords, lines, pkg, project, run } from "./docs-support";

const section = (id: string, title: string) => ({
  id,
  title,
  codes: [],
  text: `# ${id}: ${title}\nstatus: implemented\n`,
});
const filesFor = (rows: { id: string; area: string; holds: string }[]) => [
  ...project(["cli", "router"]),
  ...cliPkg(
    rows.map((r) => ({ id: r.id, title: `Title ${r.id}`, package: "@keel/router", holds: r.holds, area: r.area })),
    [],
  ),
  ...pkg(
    "router",
    "2.0.0",
    rows.map((r) => section(r.id, `Title ${r.id}`)),
  ),
];

describe("k.docs areas", () => {
  const rows = [
    { id: "k.x", area: "a", holds: "what x holds" },
    { id: "k.y", area: "a", holds: "what y holds" },
    { id: "k.z", area: "b", holds: "what z holds" },
  ];

  it("`keel docs a` emits docs.area { id: a, sections: 2 }, then the docs.entry of k.x, then of k.y, each with its holds, and nothing of k.z", async () => {
    const r = await jsonRecords(["docs", "a"], filesFor(rows));
    expect(r.code).toBe(0);
    const recs = r.recs.filter((x) => x.kind !== "summary");
    expect(recs).toHaveLength(3);
    expect(recs[0]).toMatchObject({ kind: "docs.area", id: "a", sections: 2 });
    expect(recs[1]).toMatchObject({ kind: "docs.entry", id: "k.x", package: "@keel/router", holds: "what x holds" });
    expect(recs[2]).toMatchObject({ kind: "docs.entry", id: "k.y", package: "@keel/router", holds: "what y holds" });
    expect(r.out).not.toContain("k.z");
  });

  it("compact `keel docs a` prints `k.x <title> <package>: <holds>`", async () => {
    const r = await run(["docs", "a", "--format=compact"], { files: filesFor(rows) });
    expect(lines(r.stdout)).toContain("k.x Title k.x @keel/router: what x holds");
    expect(lines(r.stdout)).toContain("k.y Title k.y @keel/router: what y holds");
    expect(r.stdout).not.toContain("k.z");
  });

  it("`keel docs <area>` lists the area's sections in the order of map.json, whatever the order", async () => {
    const order = fc.shuffledSubarray(["k.a", "k.b", "k.c", "k.d", "k.e"], { minLength: 1, maxLength: 5 });
    await fc.assert(
      fc.asyncProperty(order, async (ids) => {
        const r = await jsonRecords(
          ["docs", "a"],
          filesFor([
            ...ids.map((id) => ({ id, area: "a", holds: `holds ${id}` })),
            { id: "k.z", area: "b", holds: "z" },
          ]),
        );
        const recs = r.recs.filter((x) => x.kind !== "summary");
        expect(recs[0]).toMatchObject({ kind: "docs.area", id: "a", sections: ids.length });
        expect(recs.slice(1).map((e) => e.id)).toEqual(ids);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("`keel docs zz` for an area map.json lacks emits E1052, exit 2", async () => {
    const r = await run(["docs", "zz"], { files: filesFor(rows) });
    expect(r.code).toBe(2);
    expect(r.stdout + r.stderr).toContain("E1052");
  });
});
