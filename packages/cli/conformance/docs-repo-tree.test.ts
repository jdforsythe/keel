// Spec: k.docs, clause "Under a root with `spec/00-map.md` and no `node_modules/@keel/` docs, `keel docs k.cli` prints `spec/kernel/k.cli.md` and `--for` reads `spec/`."
// Spec: k.docs, clause "Under a root with `spec/00-map.md` listing area `a` and `spec/areas/a.md` listing `k.x`, `keel docs a` prints `# a: <the map row's title>` and a row `| k.x | <title> | <status> | <holds> |`, title and status read from `spec/kernel/k.x.md`'s first two lines."
// k.docs "The Keel repo": the map is `spec/00-map.md` as one `docs.section` with id `map`; skills at `packages/cli/skills/<name>/SKILL.md`.
// Seed: none. Red: `docs` is absent (E1051).
import { describe, expect, it } from "vitest";
import { jsonRecords } from "./docs-support";

const files = [
  { path: "spec/00-map.md", source: "# Map\n| k.cli | CLI |\n" },
  { path: "spec/kernel/k.cli.md", source: "# k.cli: CLI\nstatus: implemented\nE1051 unknown command\n" },
  { path: "spec/std/std.tables.md", source: "# std.tables\nE1051 mentioned in std\n" },
  {
    path: "packages/cli/skills/keel-client/SKILL.md",
    source: "---\nname: keel-client\ndescription: Client\n---\nbody\n",
  },
];

describe("k.docs in the Keel repo", () => {
  it("`keel docs k.cli` prints spec/kernel/k.cli.md", async () => {
    const r = await jsonRecords(["docs", "k.cli"], files);
    expect(r.code).toBe(0);
    expect(r.recs.find((x) => x.kind === "docs.section")).toMatchObject({ id: "k.cli", text: files[1]?.source });
  });

  it("`keel docs` prints the map as one docs.section with id map", async () => {
    const r = await jsonRecords(["docs"], files);
    expect(r.code).toBe(0);
    const secs = r.recs.filter((x) => x.kind === "docs.section");
    expect(secs).toHaveLength(1);
    expect(secs[0]).toMatchObject({ id: "map", text: files[0]?.source });
  });

  it("`keel docs keel-client` reads packages/cli/skills/keel-client/SKILL.md", async () => {
    const r = await jsonRecords(["docs", "keel-client"], files);
    expect(r.recs.find((x) => x.kind === "docs.skill")).toMatchObject({ id: "keel-client", text: files[3]?.source });
  });

  it("`--for` reads every line of spec/**.md", async () => {
    const r = await jsonRecords(["docs", "--for", "E1051"], files);
    expect(r.code).toBe(0);
    const cites = r.recs.filter((x) => x.kind === "docs.cite");
    expect(cites.map((c) => [c.id, c.line])).toEqual([
      ["k.cli", 3],
      ["std.tables", 2],
    ]);
  });

  it("`keel docs a` prints `# a: <the map row's title>` and a row `| k.x | <title> | <status> | <holds> |`", async () => {
    const tree = [
      { path: "spec/00-map.md", source: "# Keel spec map\n\n| area | holds |\n|-|-|\n| a | Alpha things and more |\n" },
      { path: "spec/areas/a.md", source: "# a\n| id | holds |\n|-|-|\n| k.x | what x holds |\n" },
      { path: "spec/kernel/k.x.md", source: "# k.x: The x section\nstatus: proposed\nbody\n" },
    ];
    const r = await jsonRecords(["docs", "a"], tree);
    expect(r.code).toBe(0);
    const secs = r.recs.filter((x) => x.kind === "docs.section");
    expect(secs).toHaveLength(1);
    expect(secs[0]).toMatchObject({ id: "a" });
    const text = String(secs[0]?.text);
    const ls = text.split("\n");
    expect(ls[0]).toBe("# a: Alpha things and more");
    expect(ls).toContain("| id | title | status | holds |");
    expect(ls).toContain("| k.x | The x section | proposed | what x holds |");
    expect(text).not.toContain("body");
  });
});
