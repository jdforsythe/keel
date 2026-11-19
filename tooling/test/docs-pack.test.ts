import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildDocs,
  checkOwners,
  checkRepo,
  codesIn,
  listPackages,
  readSections,
  tableTitles,
  titleOf,
  writeDocs,
} from "../docs-pack.mjs";

const scratch: string[] = [];
afterEach(() => {
  for (const d of scratch.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

/** A small repo: two sections each in kernel and std, three packages, and the map tables. */
function fixture(owners: Record<string, string[]>): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "docs-pack-"));
  scratch.push(repo);
  const put = (rel: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
    fs.writeFileSync(path.join(repo, rel), text);
  };
  put(
    "spec/00-map.md",
    "| id | section | status | one line |\n|-|-|-|-|\n| k.b | Short b | proposed | x |\n| k.a | A | proposed | x |\n",
  );
  put(
    "spec/std/README.md",
    "| id | section | status | one line |\n| --- | --- | --- | --- |\n| std.z | Zed | proposed | x |\n",
  );
  put("spec/kernel/k.a.md", "# k.a: Section A\nstatus: proposed\n\nE1002 and E1001 and E1002, W1003.\n");
  put("spec/kernel/k.b.md", "# k.b: Section B long\nstatus: proposed\n\nno codes\n");
  put("spec/kernel/k.c.md", "# k.c: Unlisted\nstatus: proposed\n");
  put("spec/std/std.z.md", "# std.z: Zed section\nstatus: proposed\n\nE2001\n");
  for (const name of ["cli", "std-z", "other"])
    put(`packages/${name}/package.json`, JSON.stringify({ name: `@keel/${name}` }));
  put("tooling/docs-owners.json", JSON.stringify(owners));
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
  it("reads ids and titles from the rows of a table and ignores other rows", () => {
    const rows = tableTitles("| id | section |\n|-|-|\n| k.a | A | x |\n| notes | no | y |\n");
    expect([...rows]).toEqual([["k.a", "A"]]);
  });
  it("orders sections by the map tables, then by id, with the map title for a listed one", () => {
    const sections = readSections(path.join(fixture(owned), "spec"));
    expect(sections.map((s) => [s.id, s.mapTitle])).toEqual([
      ["k.b", "Short b"],
      ["k.a", "A"],
      ["std.z", "Zed"],
      ["k.c", "Unlisted"],
    ]);
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
    const cli = JSON.parse((build().get("@keel/cli") ?? {})["docs/index.json"] ?? "{}");
    expect(cli.sections).toEqual([
      { codes: ["E1001", "E1002", "W1003"], id: "k.a", title: "Section A" },
      { codes: [], id: "k.b", title: "Section B long" },
      { codes: [], id: "k.c", title: "Unlisted" },
    ]);
  });
  it("writes the section text verbatim", () => {
    const cli = build().get("@keel/cli") ?? {};
    expect(cli["docs/k.a.md"]).toBe("# k.a: Section A\nstatus: proposed\n\nE1002 and E1001 and E1002, W1003.\n");
  });
  it("gives only @keel/cli the map, in map order with the owner of each section", () => {
    const built = build();
    const map = JSON.parse((built.get("@keel/cli") ?? {})["docs/map.json"] ?? "{}");
    expect(map.sections).toEqual([
      { id: "k.b", package: "@keel/cli", title: "Short b" },
      { id: "k.a", package: "@keel/cli", title: "A" },
      { id: "std.z", package: "@keel/std-z", title: "Zed" },
      { id: "k.c", package: "@keel/cli", title: "Unlisted" },
    ]);
    expect(Object.keys(built.get("@keel/std-z") ?? {})).not.toContain("docs/map.json");
  });
  it("gives a package that owns nothing an empty index", () => {
    expect((build().get("@keel/other") ?? {})["docs/index.json"]).toBe(
      `${JSON.stringify({ sections: [] }, null, 2)}\n`,
    );
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
    );
    const n = writeDocs(
      built,
      listPackages(repo).filter((p: { name: string }) => p.name === "@keel/cli"),
    );
    expect(n).toBe(5);
    expect(fs.readdirSync(path.join(cli, "docs")).sort()).toEqual([
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
