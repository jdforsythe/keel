// Spec: k.docs, clause "An installed package whose `index.json` lists an id `map.json` lacks: `keel docs` ends its areas with `other`, `sections: 1`; `keel docs other` lists the id; `keel docs <id>` prints it. With no such id, `keel docs` prints no `other`."
// Seed: none. Red: `docs` is absent (E1051).
import { describe, expect, it } from "vitest";
import { baseline, jsonRecords, pkg } from "./docs-support";

const NEWER = { id: "k.newer", title: "Newer", codes: [], text: "# k.newer: Newer\nstatus: implemented\n" };

describe("k.docs index-only ids", () => {
  const files = baseline(pkg("std-tables", "0.9.0", [NEWER], { base: "node_modules/@keel/std-tables" }));

  it("an installed package's index.json id that map.json lacks: `keel docs` ends its areas with `other`, `sections: 1`", async () => {
    const r = await jsonRecords(["docs"], files);
    expect(r.code).toBe(0);
    const areas = r.recs.filter((x) => x.kind === "docs.area");
    expect(areas.length).toBeGreaterThan(1);
    expect(areas[areas.length - 1]).toMatchObject({ id: "other", sections: 1 });
    expect(areas.filter((a) => a.id === "other")).toHaveLength(1);
    const lastArea = r.recs.lastIndexOf(areas[areas.length - 1] ?? {});
    const firstEntry = r.recs.findIndex((x) => x.kind === "docs.entry");
    expect(firstEntry).toBeGreaterThan(lastArea);
    expect(r.recs.some((x) => x.kind === "docs.entry" && x.id === "k.newer")).toBe(false);
  });

  it("`keel docs other` lists the id", async () => {
    const r = await jsonRecords(["docs", "other"], files);
    expect(r.code).toBe(0);
    expect(r.recs[0]).toMatchObject({ kind: "docs.area", id: "other", sections: 1 });
    const entries = r.recs.filter((x) => x.kind === "docs.entry");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: "k.newer", title: "Newer", package: "@keel/std-tables", installed: true });
  });

  it("`keel docs <id>` prints that id's section from the installed package", async () => {
    const r = await jsonRecords(["docs", "k.newer"], files);
    expect(r.code).toBe(0);
    expect(r.recs.find((x) => x.kind === "docs.section")).toMatchObject({
      id: "k.newer",
      package: "@keel/std-tables",
      version: "0.9.0",
      text: NEWER.text,
    });
  });

  it("with no such id, `keel docs` prints no `other`", async () => {
    const r = await jsonRecords(["docs"], baseline());
    expect(r.code).toBe(0);
    expect(r.recs.some((x) => x.kind === "docs.area" && x.id === "other")).toBe(false);
    expect(r.out).not.toMatch(/(^|\n)other /);
  });
});
