// Spec: k.docs, clause "An installed package whose `index.json` lists an id `map.json` lacks: `keel docs` lists it and `keel docs <id>` prints it."
// Seed: none. Red: `docs` is absent (E1051).
import { describe, expect, it } from "vitest";
import { baseline, jsonRecords, pkg } from "./docs-support";

const NEWER = { id: "k.newer", title: "Newer", codes: [], text: "# k.newer: Newer\nstatus: implemented\n" };

describe("k.docs index-only ids", () => {
  const files = baseline(pkg("std-tables", "0.9.0", [NEWER], { base: "node_modules/@keel/std-tables" }));

  it("an installed package's index.json id that map.json lacks is listed by `keel docs`", async () => {
    const r = await jsonRecords(["docs"], files);
    const hits = r.recs.filter((x) => x.kind === "docs.entry" && x.id === "k.newer");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ title: "Newer", package: "@keel/std-tables", installed: true });
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
});
