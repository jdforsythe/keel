// Spec: k.docs, clause "`keel docs --for <code>` prints each line citing the code in the installed sections listing it and none from a package not installed; a code cited nowhere prints no `docs.cite`, exit 0."
// Seed: none. Compact `k.cli:43 <text>` and the 160-character cut from k.docs "Forms". Red: `docs` is absent (E1051).
import { describe, expect, it } from "vitest";
import { baseline, jsonRecords, lines, pkg, run } from "./docs-support";

const long = `E1451 ${"x".repeat(300)}`;
const listed = {
  id: "k.router",
  title: "Routes",
  codes: ["E1451"],
  text: `# k.router\n\nplain\nuses E1451 here\n${long}\n`,
};
const unlisted = { id: "k.other", title: "Other", codes: [], text: "# k.other\nE1451 cited but not listed\n" };

describe("k.docs --for", () => {
  const files = baseline([...pkg("router", "2.3.4", [listed, unlisted])]);

  it("`--for <code>` prints one docs.cite per line citing the code, in sections whose index lists it", async () => {
    const r = await jsonRecords(["docs", "--for", "E1451"], files);
    expect(r.code).toBe(0);
    const cites = r.recs.filter((x) => x.kind === "docs.cite");
    expect(cites.map((c) => [c.code, c.id, c.line])).toEqual([
      ["E1451", "k.router", 4],
      ["E1451", "k.router", 5],
    ]);
    expect(cites[0]?.text).toBe("uses E1451 here");
    expect(String(cites[1]?.text).length).toBeLessThanOrEqual(160);
  });

  it("compact `--for` prints `<id>:<line> <text>`", async () => {
    const r = await run(["docs", "--for", "E1451", "--format=compact"], { files });
    expect(lines(r.stdout)).toContain("k.router:4 uses E1451 here");
  });

  it("`--for` prints no line from a package that is not installed", async () => {
    const withTables = baseline([...pkg("router", "2.3.4", [listed])]);
    const r = await jsonRecords(["docs", "--for", "E1451"], withTables);
    expect(r.recs.filter((x) => x.kind === "docs.cite").every((c) => c.id === "k.router")).toBe(true);
    const nothing = await jsonRecords(
      ["docs", "--for", "E1451"],
      baseline().filter((f) => !f.path.startsWith("node_modules/@keel/router/")),
    );
    expect(nothing.recs.filter((x) => x.kind === "docs.cite")).toEqual([]);
  });

  it("a code cited nowhere prints no docs.cite, exit 0", async () => {
    const r = await jsonRecords(["docs", "--for", "E9999"], files);
    expect(r.code).toBe(0);
    expect(r.recs.filter((x) => x.kind === "docs.cite")).toEqual([]);
  });
});
