// Exact-output tests for docsCommand, readDocs and the agent files (mutation killers). Fixtures are synthetic: no
// test depends on the skills the cli publishes.
import { describe, expect, it } from "vitest";
import { agentWarnings } from "../src/docs/agentWarnings.ts";
import { agentWrites } from "../src/docs/agentWrites.ts";
import { docsCommand } from "../src/docs/docsCommand.ts";
import { readDocs } from "../src/docs/readDocs.ts";
import type { Input } from "../src/types/Input.ts";

const CWD = "/work/app";
const f = (path: string, source: string) => ({ path, source });
const json = (v: unknown): string => `${JSON.stringify(v)}\n`;
const CLI = "node_modules/@keel/cli";
const skill = (name: string, description: string) =>
  f(`${CLI}/skills/${name}/SKILL.md`, `---\nname: ${name}\ndescription: ${description}\n---\nbody of ${name}\n`);
const installed = [
  f("package.json", json({ dependencies: { "@keel/router": "*" } })),
  f(`${CLI}/package.json`, json({ name: "@keel/cli", version: "1.2.0" })),
  f(`${CLI}/docs/index.json`, json({ sections: [{ id: "k.cli", title: "CLI", codes: ["E1051"] }] })),
  f(`${CLI}/docs/k.cli.md`, "# k.cli\nE1051 unknown\n"),
  f(
    `${CLI}/docs/map.json`,
    json({
      sections: [
        { id: "k.cli", title: "CLI", package: "@keel/cli" },
        { id: "k.router", title: "Routes", package: "@keel/router" },
        { id: "std.tables", title: "Tables", package: "@keel/std-tables" },
      ],
    }),
  ),
  skill("keel-b", '"Second skill"'),
  skill("keel-a", "First skill"),
  f("node_modules/@keel/router/package.json", json({ name: "@keel/router", version: "2.0.0" })),
  f(
    "node_modules/@keel/router/docs/index.json",
    json({
      sections: [
        { id: "k.router", title: "Routes", codes: ["E1451"] },
        { id: "k.extra", title: "Extra", codes: [] },
      ],
    }),
  ),
  f("node_modules/@keel/router/docs/k.router.md", "# k.router\n  E1451 dup  \nno\n"),
  f("node_modules/@keel/router/docs/k.extra.md", "# k.extra\n"),
];
const docs = (input: Input, files = installed) => docsCommand(input, { cwd: CWD, files });
const fail = (code: string, message: string) => [
  { kind: "diag", code, message, see: "k.docs" },
  { kind: "summary", ok: false, name: "docs", counts: {} },
];

describe("docsCommand, installed", () => {
  it("lists map rows, then index-only ids, then skills sorted by name", () => {
    expect(docs({}).records).toEqual([
      { kind: "docs.entry", id: "k.cli", title: "CLI", package: "@keel/cli", installed: true },
      { kind: "docs.entry", id: "k.router", title: "Routes", package: "@keel/router", installed: true },
      { kind: "docs.entry", id: "std.tables", title: "Tables", package: "@keel/std-tables", installed: false },
      { kind: "docs.entry", id: "k.extra", title: "Extra", package: "@keel/router", installed: true },
      { kind: "docs.entry", id: "keel-a", title: "First skill", package: "@keel/cli", installed: true },
      { kind: "docs.entry", id: "keel-b", title: "Second skill", package: "@keel/cli", installed: true },
      { kind: "summary", ok: true, name: "docs", counts: { sections: 4, skills: 2 } },
    ]);
  });

  it("prints a section with its package and version, and a skill with the cli's version", () => {
    expect(docs({ id: "k.router" }).records).toEqual([
      {
        kind: "docs.section",
        id: "k.router",
        package: "@keel/router",
        version: "2.0.0",
        text: "# k.router\n  E1451 dup  \nno\n",
      },
      { kind: "summary", ok: true, name: "docs k.router", counts: { tokens: 7 } },
    ]);
    expect(docs({ id: "keel-a" }).records).toEqual([
      {
        kind: "docs.skill",
        id: "keel-a",
        version: "1.2.0",
        text: "---\nname: keel-a\ndescription: First skill\n---\nbody of keel-a\n",
      },
      { kind: "summary", ok: true, name: "docs keel-a", counts: {} },
    ]);
    expect(docs({ id: "k.extra" }).records[0]).toMatchObject({ id: "k.extra", package: "@keel/router" });
  });

  it("E1065 not installed, E1066 missing file or index or map, E1052 unknown or two forms", () => {
    expect(docs({ id: "std.tables" }).records).toEqual(
      fail("E1065", "std.tables is in @keel/std-tables, which is not installed; add @keel/std-tables"),
    );
    const noFile = installed.filter((x) => !x.path.endsWith("k.router.md"));
    expect(docs({ id: "k.router" }, noFile).records).toEqual(
      fail("E1066", "@keel/router 2.0.0 has no docs/k.router.md"),
    );
    const noIndex = installed.filter((x) => x.path !== "node_modules/@keel/router/docs/index.json");
    expect(docs({ id: "k.router" }, noIndex).records).toEqual(
      fail("E1066", "@keel/router 2.0.0 has no readable docs/index.json"),
    );
    const noMap = installed.filter((x) => !x.path.endsWith("map.json"));
    expect(docs({}, noMap).records).toEqual(fail("E1066", "@keel/cli 1.2.0 has no docs/map.json"));
    expect(docs({ id: "k.nope" }, noMap).records).toEqual(fail("E1066", "@keel/cli 1.2.0 has no docs/map.json"));
    expect(docs({ id: "k.extra" }, noMap).records[0]).toMatchObject({ kind: "docs.section" });
    expect(docs({ id: "n".repeat(40) }).records[0]).toEqual({
      kind: "diag",
      code: "E1052",
      message: `no section or skill "${"n".repeat(24)}"; see keel docs`,
      see: "k.docs",
    });
    for (const input of [
      { id: "a", for: "E1" },
      { id: "a", sync: true },
      { for: "E1", sync: true },
    ])
      expect(docs(input).records).toEqual(fail("E1052", "give one of <id>, --for <code>, --sync"));
    expect(docs({ id: "k.cli", sync: false }).records[0]).toMatchObject({ kind: "docs.section" });
  });

  it("--for cites trimmed lines of the sections whose index lists the code", () => {
    expect(docs({ for: "E1451" }).records).toEqual([
      { kind: "docs.cite", code: "E1451", id: "k.router", line: 2, text: "E1451 dup" },
      { kind: "summary", ok: true, name: "docs --for E1451", counts: { lines: 1 } },
    ]);
    expect(docs({ for: "E9" }).records).toEqual([
      { kind: "summary", ok: true, name: "docs --for E9", counts: { lines: 0 } },
    ]);
    const long = [
      ...installed.filter((x) => !x.path.endsWith("k.router.md")),
      f("node_modules/@keel/router/docs/k.router.md", `E1451${"x".repeat(200)}`),
    ];
    expect(docs({ for: "E1451" }, long).records[0]).toMatchObject({ text: `E1451${"x".repeat(155)}` });
  });

  it("a package only under the cli's node_modules resolves; the project's copy wins", () => {
    const nested = installed.map((x) =>
      x.path.startsWith("node_modules/@keel/router/") ? f(`${CLI}/${x.path}`, x.source) : x,
    );
    expect(docs({ id: "k.router" }, nested).records[0]).toMatchObject({ version: "2.0.0" });
    const both = [
      ...nested,
      f("node_modules/@keel/router/package.json", json({ name: "@keel/router", version: "3.0.0" })),
    ];
    const r = readDocs(both).installed.get("@keel/router");
    expect(r).toMatchObject({ base: "node_modules/@keel/router", version: "3.0.0", index: undefined });
  });

  it("a package whose package.json name is not @keel/<folder> is not installed", () => {
    const wrong = installed.map((x) =>
      x.path === "node_modules/@keel/router/package.json"
        ? f(x.path, json({ name: "@keel/evil", version: "2.0.0" }))
        : x,
    );
    expect(readDocs(wrong).installed.has("@keel/router")).toBe(false);
    expect(docs({ id: "k.router" }, wrong).records[0]).toMatchObject({ code: "E1065" });
    const unnamed = installed.map((x) =>
      x.path === "node_modules/@keel/router/package.json" ? f(x.path, json({ version: "2.0.0" })) : x,
    );
    expect(readDocs(unnamed).installed.has("@keel/router")).toBe(false);
  });
});

describe("docsCommand, the Keel repo", () => {
  const repo = [
    f("spec/00-map.md", "# map\n"),
    f("spec/kernel/k.a.md", "# k.a\nE1 here\n"),
    f("spec/std/s.b.md", "# s.b\nE1 std\n"),
    f("spec/kernel/both.md", "# kernel both\n"),
    f("spec/std/both.md", "# std both\n"),
    f("packages/cli/skills/keel-a/SKILL.md", "---\nname: keel-a\ndescription: A\n---\n"),
    skill("keel-z", "ignored in the repo"),
  ];
  it("map with the repo's skills, a section kernel first, a skill, --for over spec/", () => {
    expect(docs({}, repo).records).toEqual([
      { kind: "docs.section", id: "map", text: "# map\n" },
      { kind: "docs.entry", id: "keel-a", title: "A", package: "@keel/cli", installed: true },
      { kind: "summary", ok: true, name: "docs map", counts: {} },
    ]);
    expect(docs({ id: "both" }, repo).records[0]).toEqual({
      kind: "docs.section",
      id: "both",
      text: "# kernel both\n",
    });
    expect(docs({ id: "s.b" }, repo).records[0]).toEqual({ kind: "docs.section", id: "s.b", text: "# s.b\nE1 std\n" });
    expect(docs({ id: "keel-a" }, repo).records[0]).toMatchObject({ kind: "docs.skill", id: "keel-a" });
    expect(docs({ for: "E1" }, repo).records.map((r) => [r.id, r.line])).toEqual([
      ["k.a", 2],
      ["s.b", 2],
      [undefined, undefined],
    ]);
    expect(docs({ id: "nope" }, repo).records[0]).toMatchObject({ code: "E1052" });
  });
  it("the repo without its own skills reads the running cli's", () => {
    const bare = repo.filter((x) => !x.path.startsWith("packages/"));
    expect(readDocs(bare).skills.map((s) => s.name)).toEqual(["keel-z"]);
  });
});

describe("agent files", () => {
  const skills = [skill("keel-a", "A")];
  it("--sync creates every file, then changes nothing", () => {
    const first = docs({ sync: true }, skills);
    expect(first.records.map((r) => [r.kind, r.action, r.path])).toEqual([
      ["scaffold.edit", "create", ".claude/skills/keel-a/SKILL.md"],
      ["scaffold.edit", "create", "AGENTS.md"],
      ["scaffold.edit", "create", "CLAUDE.md"],
      ["summary", undefined, undefined],
    ]);
    expect(first.records.at(-1)).toEqual({
      kind: "summary",
      ok: true,
      name: "docs --sync",
      counts: { created: 3, changed: 0 },
    });
    const after = [...skills, ...first.writes.map((w) => f(w.path, w.content ?? ""))];
    expect(docs({ sync: true }, after).writes).toEqual([]);
    expect(agentWarnings(after)).toEqual([]);
    const edited = after.map((x) => (x.path === "AGENTS.md" ? f(x.path, `mine\n${x.source}`) : x));
    expect(docs({ sync: true }, edited).writes).toEqual([]);
    const stale = after.map((x) => (x.path.startsWith(".claude/") ? f(x.path, "old\n") : x));
    expect(docs({ sync: true }, stale).records[0]).toMatchObject({
      action: "change",
      path: ".claude/skills/keel-a/SKILL.md",
    });
    expect(agentWarnings(stale)).toEqual([
      {
        kind: "diag",
        code: "W1356",
        path: ".claude/skills/keel-a/SKILL.md",
        line: 1,
        col: 1,
        message: "stale agent file; run keel docs --sync",
        see: "k.scaffold",
      },
    ]);
    const gone = after.filter((x) => !x.path.startsWith(".claude/"));
    expect(agentWarnings(gone).map((d) => d.message)).toEqual(["missing agent file; run keel docs --sync"]);
    const noClaude = after.filter((x) => x.path !== "CLAUDE.md");
    expect(agentWarnings(noClaude)).toEqual([]);
  });

  it("E1355 on a malformed block: --sync writes nothing, check warns at AGENTS.md", () => {
    const bad = [...skills, f("AGENTS.md", "<!-- keel:start -->\nx\n")];
    const r = docs({ sync: true }, bad);
    expect(r.writes).toEqual([]);
    expect(r.records[0]).toMatchObject({ code: "E1355", path: "AGENTS.md", line: 1 });
    expect(agentWarnings(bad).map((d) => [d.code, d.path])).toEqual([["W1356", "AGENTS.md"]]);
    expect(agentWarnings([...skills, f("AGENTS.md", "# mine\n")])).toEqual([]);
  });

  it("scaffold project gets the block, CLAUDE.md and the copies", () => {
    expect([...agentWrites(skills).keys()]).toEqual([".claude/skills/keel-a/SKILL.md", "AGENTS.md", "CLAUDE.md"]);
    expect(agentWrites([]).get("CLAUDE.md")).toBe("@AGENTS.md\n");
  });
});
