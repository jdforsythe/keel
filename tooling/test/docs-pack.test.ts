import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  badWords,
  buildDocs,
  checkAreas,
  checkOwners,
  checkRepo,
  codesIn,
  listPackages,
  readAreas,
  readSections,
  titleOf,
  writeDocs,
} from "../docs-pack.mjs";

const scratch: string[] = [];
afterEach(() => {
  for (const d of scratch.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

/** A small repo: two sections each in kernel and std, three packages, the map, two area files and a glossary. */
function fixture(owners: Record<string, string[]>, edit: Record<string, string | undefined> = {}): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "docs-pack-"));
  scratch.push(repo);
  const files: Record<string, string | undefined> = {
    "spec/00-map.md":
      "# Keel spec map\n\n| area | holds |\n|-|-|\n| one | The first area |\n| two | The second area |\n",
    "spec/areas/one.md": "# one\n| id | holds |\n|-|-|\n| k.b | what b holds |\n| k.a | what a holds |\n",
    "spec/areas/two.md": "# two\n| id | holds |\n|-|-|\n| std.z | what z holds |\n| k.c | what c holds |\n",
    "spec/std/README.md": "# Stdlib spec\n",
    "spec/kernel/k.a.md": "# k.a: Section A\nstatus: proposed\n\nE1002 and E1001 and E1002, W1003.\n",
    "spec/kernel/k.b.md": "# k.b: Section B long\nstatus: implemented\n\nno codes\n",
    "spec/kernel/k.c.md": "# k.c: Section C\nstatus: proposed\n",
    "spec/std/std.z.md": "# std.z: Zed section\nstatus: proposed\n\nE2001\n",
    "docs/GLOSSARY.md": "# Glossary\n\n- **thing a**: what k.a and k.gone say (k.a).\n- **zed**: see std.z.\n",
    "tooling/titles.json": JSON.stringify({ clipped: { a11y: "accessibility", sim: "simulation" }, names: ["CLI"] }),
    ...edit,
  };
  for (const name of ["cli", "std-z", "other"])
    files[`packages/${name}/package.json`] = JSON.stringify({ name: `@keel/${name}` });
  files["tooling/docs-owners.json"] = JSON.stringify(owners);
  for (const [rel, text] of Object.entries(files)) {
    if (text === undefined) continue;
    fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
    fs.writeFileSync(path.join(repo, rel), text);
  }
  return repo;
}
const owned = { "@keel/cli": ["k.a", "k.b", "k.c"], "@keel/std-z": ["std.z"] };

describe("section reading", () => {
  it("takes the title from the header line, or the id when it is missing", () => {
    expect(titleOf("# k.a: Section A\n", "k.a")).toBe("Section A");
    expect(titleOf("no header\n", "k.a")).toBe("k.a");
  });
  it("lists the codes a text cites once each, sorted", () => {
    expect(codesIn("E1002 E1001 E1002 W1003 I1055 T0001 E12345")).toEqual(["E1001", "E1002", "I1055", "W1003"]);
  });
  it("orders sections by the areas, then by id", () => {
    const sections = readSections(path.join(fixture(owned), "spec"));
    expect(sections.map((s: { id: string }) => s.id)).toEqual(["k.b", "k.a", "std.z", "k.c"]);
  });
  it("reads each area's sections with their own title and status and the area file's holds", () => {
    const areas = readAreas(path.join(fixture(owned), "spec"));
    expect(areas.map((a: { id: string; title: string }) => [a.id, a.title])).toEqual([
      ["one", "The first area"],
      ["two", "The second area"],
    ]);
    expect(areas[0].sections[0]).toEqual({
      id: "k.b",
      title: "Section B long",
      status: "implemented",
      package: "",
      holds: "what b holds",
      codes: [],
    });
  });
});

describe("areas and titles", () => {
  const codes = (repo: string): string[][] =>
    checkRepo(repo).diags.map((d: { code: string; message: string }) => [d.code, d.message]);
  it("is clean on the fixture", () => {
    expect(codes(fixture(owned))).toEqual([]);
  });
  it("D0019: a section in no area, and a section in two", () => {
    const none = fixture(owned, { "spec/areas/two.md": "# two\n| id | holds |\n|-|-|\n| std.z | z |\n" });
    expect(codes(none)).toEqual([["D0019", "k.c is in no area; add a row to spec/areas/<area>.md"]]);
    const two = fixture(owned, {
      "spec/areas/two.md": "# two\n| id | holds |\n|-|-|\n| std.z | z |\n| k.c | c |\n| k.a | a |\n",
    });
    expect(codes(two)).toEqual([["D0019", "k.a is in 2 areas: one, two"]]);
  });
  it("D0020: an area file no map row names, a map row with no file, an area row naming no section", () => {
    const repo = fixture(owned, {
      "spec/areas/three.md": "# three\n| id | holds |\n|-|-|\n",
      "spec/areas/one.md": "# one\n| id | holds |\n|-|-|\n| k.b | b |\n| k.a | a |\n| k.gone | g |\n",
    });
    expect(codes(repo)).toEqual([
      ["D0020", "area three has no row in spec/00-map.md"],
      ["D0020", "k.gone in area one is not a section"],
    ]);
    const noFile = fixture(owned, {
      "spec/00-map.md": "| area | holds |\n|-|-|\n| one | One |\n| two | Two |\n| four | Four |\n",
    });
    expect(codes(noFile)).toEqual([["D0020", "area four has no file spec/areas/four.md"]]);
  });
  it("D0021: a clipped word with the words to use, in a section title, an area title or a holds", () => {
    const repo = fixture(owned, {
      "spec/kernel/k.c.md": "# k.c: Sim clock\nstatus: proposed\n",
      "spec/00-map.md": "| area | holds |\n|-|-|\n| one | A11y things |\n| two | Two |\n",
      "spec/areas/two.md": "# two\n| id | holds |\n|-|-|\n| std.z | the `sim` ctx and sim faults |\n| k.c | c |\n",
    });
    expect(codes(repo)).toEqual([
      ["D0021", 'k.c title: "Sim" is clipped; write "simulation"'],
      ["D0021", 'area one title: "A11y" is clipped; write "accessibility"'],
      ["D0021", 'std.z holds: "sim" is clipped; write "simulation"'],
    ]);
  });
  it("D0021: a holds over 90 characters", () => {
    const repo = fixture(owned, {
      "spec/areas/two.md": `# two\n| id | holds |\n|-|-|\n| std.z | ${"z".repeat(91)} |\n| k.c | c |\n`,
    });
    expect(codes(repo)).toEqual([["D0021", "std.z holds is 91 characters, over 90"]]);
  });
  it("D0021 refuses letters mixed with digits and two capitals, but not codes, blocks, names or backticked text", () => {
    const titles = { clipped: {}, names: ["CLI", "Z3"] };
    expect(badWords("the CLI, Z3, E1042, E155x and `renderRoute` with `a11y`", titles)).toEqual([]);
    expect(badWords("Pages in v2 with ServerLog", titles)).toEqual([
      '"v2" mixes letters and digits',
      '"ServerLog" holds two capitals',
    ]);
  });
  it("checkAreas reports nothing for sections that are each in one area with clean words", () => {
    const areas = [{ id: "a", title: "Alpha", sections: [{ id: "k.x", holds: "x" }] }];
    const sections = [{ id: "k.x", file: "spec/kernel/k.x.md", headTitle: "Ex" }];
    expect(checkAreas(areas, sections, ["a"], { clipped: {}, names: [] })).toEqual([]);
  });
});

describe("checkOwners", () => {
  const ids = ["k.a", "k.b"];
  const pkgs = ["@keel/cli", "@keel/router"];
  it("is clean when every section has one existing owner", () => {
    expect(checkOwners({ "@keel/cli": ["k.a"], "@keel/router": ["k.b"] }, ids, pkgs)).toEqual([]);
  });
  it("reports D0002 for a section no package owns", () => {
    expect(checkOwners({ "@keel/cli": ["k.a"] }, ids, pkgs).map((d) => [d.code, d.message])).toEqual([
      ["D0002", "k.b has no owner package"],
    ]);
  });
  it("reports D0003 for a section two packages own", () => {
    const d = checkOwners({ "@keel/cli": ["k.a", "k.b"], "@keel/router": ["k.b"] }, ids, pkgs);
    expect(d.map((x) => [x.code, x.message])).toEqual([["D0003", "k.b has two owners: @keel/cli, @keel/router"]]);
  });
  it("reports D0004 for an owner that is not a package", () => {
    const d = checkOwners({ "@keel/cli": ["k.a", "k.b"], "@keel/nope": [] }, ids, pkgs);
    expect(d.map((x) => [x.code, x.message])).toEqual([["D0004", "@keel/nope is not a package"]]);
  });
  it("warns with W0013 for an entry naming no section, which does not fail", () => {
    const d = checkOwners({ "@keel/cli": ["k.a", "k.b", "k.gone"] }, ids, pkgs);
    expect(d.map((x) => x.code)).toEqual(["W0013"]);
  });
});

describe("buildDocs", () => {
  const repo = () => fixture(owned);
  const build = () => {
    const r = checkRepo(repo());
    return buildDocs(
      r.sections,
      r.owners,
      r.packages.map((p: { name: string }) => p.name),
      r.areas,
      r.glossary,
    );
  };
  it("gives each package the files of its sections and an index with sorted keys", () => {
    const std = build().get("@keel/std-z") ?? {};
    expect(Object.keys(std)).toEqual(["docs/std.z.md", "docs/index.json"]);
    expect(std["docs/index.json"]).toBe(
      `${JSON.stringify({ sections: [{ codes: ["E2001"], id: "std.z", title: "Zed section" }] }, null, 2)}\n`,
    );
  });
  it("lists a package's sections by id with the codes each cites", () => {
    const cli = JSON.parse(build().get("@keel/cli")?.["docs/index.json"] ?? "{}");
    expect(cli.sections).toEqual([
      { codes: ["E1001", "E1002", "W1003"], id: "k.a", title: "Section A" },
      { codes: [], id: "k.b", title: "Section B long" },
      { codes: [], id: "k.c", title: "Section C" },
    ]);
  });
  it("writes the section text verbatim", () => {
    const cli = build().get("@keel/cli") ?? {};
    expect(cli["docs/k.a.md"]).toBe("# k.a: Section A\nstatus: proposed\n\nE1002 and E1001 and E1002, W1003.\n");
  });
  it("gives only @keel/cli the map: its areas, each section with its title, owner and holds", () => {
    const built = build();
    const map = JSON.parse(built.get("@keel/cli")?.["docs/map.json"] ?? "{}");
    expect(map).toEqual({
      areas: [
        {
          id: "one",
          title: "The first area",
          sections: [
            { id: "k.b", title: "Section B long", package: "@keel/cli", holds: "what b holds" },
            { id: "k.a", title: "Section A", package: "@keel/cli", holds: "what a holds" },
          ],
        },
        {
          id: "two",
          title: "The second area",
          sections: [
            { id: "std.z", title: "Zed section", package: "@keel/std-z", holds: "what z holds" },
            { id: "k.c", title: "Section C", package: "@keel/cli", holds: "what c holds" },
          ],
        },
      ],
    });
    expect(Object.keys(built.get("@keel/std-z") ?? {})).not.toContain("docs/map.json");
  });
  it("gives only @keel/cli the glossary: each term, its text and the section ids it cites that exist", () => {
    const built = build();
    const glossary = JSON.parse(built.get("@keel/cli")?.["docs/glossary.json"] ?? "{}");
    expect(glossary).toEqual({
      terms: [
        { term: "thing a", text: "what k.a and k.gone say (k.a).", ids: ["k.a"] },
        { term: "zed", text: "see std.z.", ids: ["std.z"] },
      ],
    });
    expect(Object.keys(built.get("@keel/std-z") ?? {})).not.toContain("docs/glossary.json");
  });
  it("gives a package that owns nothing an empty index", () => {
    expect(build().get("@keel/other")?.["docs/index.json"]).toBe(`${JSON.stringify({ sections: [] }, null, 2)}\n`);
  });
  it("is the same on every run", () => {
    expect([...build()]).toEqual([...build()]);
  });
});

describe("writeDocs", () => {
  it("replaces a package's docs folder and leaves its other files", () => {
    const repo = fixture(owned);
    const r = checkRepo(repo);
    const cli = path.join(repo, "packages", "cli");
    fs.mkdirSync(path.join(cli, "docs"), { recursive: true });
    fs.writeFileSync(path.join(cli, "docs", "stale.md"), "old");
    const built = buildDocs(
      r.sections,
      r.owners,
      r.packages.map((p: { name: string }) => p.name),
      r.areas,
      r.glossary,
    );
    const n = writeDocs(
      built,
      listPackages(repo).filter((p: { name: string }) => p.name === "@keel/cli"),
    );
    expect(n).toBe(6);
    expect(fs.readdirSync(path.join(cli, "docs")).sort()).toEqual([
      "glossary.json",
      "index.json",
      "k.a.md",
      "k.b.md",
      "k.c.md",
      "map.json",
    ]);
    expect(fs.existsSync(path.join(cli, "package.json"))).toBe(true);
    expect(fs.existsSync(path.join(repo, "packages", "std-z", "docs"))).toBe(false);
  });
});

describe("checkRepo", () => {
  it("passes on the fixture and fails on a missing owner", () => {
    expect(checkRepo(fixture(owned)).diags).toEqual([]);
    expect(checkRepo(fixture({ "@keel/cli": ["k.a"] })).diags.map((d: { code: string }) => d.code)).toEqual([
      "D0002",
      "D0002",
      "D0002",
    ]);
  });
});

describe("pnpm spec", () => {
  const root = path.join(import.meta.dirname, "..", "..");
  const out = (args: string[]): string =>
    spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", env: { ...process.env, KEEL_AGENT: "1" } }).stdout;
  it("prints what `keel docs <area>` prints in the repo", () => {
    const area = readAreas(path.join(root, "spec"))[0]?.id ?? "";
    const spec = out(["tooling/spec.mjs", area]);
    expect(spec).toContain(`# ${area}: `);
    expect(spec).toBe(out(["packages/cli/src/bin.ts", "docs", area]));
  });
});
