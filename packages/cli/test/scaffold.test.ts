// keel scaffold / codemod over io.files through @keel/scaffold; keel build through @keel/compiler.
import { describe, expect, it } from "vitest";
import { diffEdits } from "../src/internal/diffEdits.ts";
import { runEngine } from "../src/internal/runEngine.ts";
import type { Io } from "../src/types/Io.ts";
import { applyEdits } from "./support/applyEdits.ts";

const CWD = "/work/shop";
const lines = (out: string): string[] => out.split("\n").filter((l) => l !== "");
type Files = { path: string; source: string }[];
const applied = (files: Files, writes: readonly { path: string; content: string | null }[]): Files => {
  const m = new Map(files.map((f) => [f.path, f.source]));
  for (const w of writes)
    if (w.content === null) m.delete(w.path);
    else m.set(w.path, w.content);
  return [...m].map(([path, source]) => ({ path, source }));
};
const project = async (): Promise<Files> =>
  applied([], (await runEngine(["scaffold", "project", "shop"], { cwd: CWD })).writes);

describe("scaffold and codemod", () => {
  it("scaffold project lists the created files and returns them as writes", async () => {
    const e = await runEngine(["scaffold", "project", "shop"], { cwd: CWD, files: [] });
    expect(e.result.code).toBe(0);
    expect(lines(e.result.stdout)).toContain("create topology.ts");
    expect(lines(e.result.stdout).at(-1)).toMatch(/^ok scaffold project \d+ created, 0 changed, 0 removed$/);
    expect(e.writes.map((w) => w.path)).toContain("topology.ts");
  });

  it("scaffold project accepts --workspace and --adapter and emits the workspace files and .gitignore", async () => {
    const e = await runEngine(["scaffold", "project", "shop", "--workspace", "--adapter", "node"], {
      cwd: CWD,
      files: [],
    });
    expect(e.result.code).toBe(0);
    const paths = e.writes.map((w) => w.path);
    expect(paths).toContain("vitest.config.ts");
    expect(paths).not.toContain("turbo.json");
    const ignore = e.writes.find((w) => w.path === ".gitignore")?.content ?? "";
    expect(ignore.split("\n")).toEqual(
      expect.arrayContaining(["dist", ".turbo", "coverage", "reports", ".stryker-tmp"]),
    );
    expect(ignore).not.toContain(".keel");
    const bad = await runEngine(["scaffold", "project", "shop", "--adapter", "bogus"], { cwd: CWD, files: [] });
    expect(bad.result.code).not.toBe(0);
  });

  it("--dry-run writes nothing and prints exactly the diff a following apply writes", async () => {
    const files = await project();
    const io: Io = { cwd: CWD, files };
    const dry = await runEngine(["scaffold", "module", "orders", "--dry-run", "--format=json"], io);
    expect(dry.writes).toEqual([]);
    const apply = await runEngine(["scaffold", "module", "orders"], io);
    const before = new Map(files.map((f) => [f.path, f.source]));
    const edits = dry.records.filter((r) => r.kind === "scaffold.edit");
    expect(edits.map((r) => r.path)).toEqual(apply.writes.map((w) => w.path));
    for (const w of apply.writes) {
      const rec = edits.find((r) => r.path === w.path);
      const diff = typeof rec?.diff === "string" ? rec.diff : "";
      expect(applyEdits(before.get(w.path) ?? "", diffEdits(diff).get(w.path) ?? [])).toBe(w.content ?? "");
    }
  });

  it("running a generator twice reports E1351 the second time and writes nothing", async () => {
    const files = applied(
      await project(),
      (await runEngine(["scaffold", "module", "orders"], { cwd: CWD, files: await project() })).writes,
    );
    const again = await runEngine(["scaffold", "module", "orders"], { cwd: CWD, files });
    expect(again.result.code).toBe(1);
    expect(lines(again.result.stdout)[0]).toMatch(/^E1351 /);
    expect(again.writes).toEqual([]);
  });

  it("codemod rename infers the kind; rename A B then B A restores the tree", async () => {
    const base = await project();
    const withCard = applied(
      base,
      (await runEngine(["scaffold", "component", "app/OrderCard"], { cwd: CWD, files: base })).writes,
    );
    const there = await runEngine(["codemod", "rename", "OrderCard", "OrderTile"], { cwd: CWD, files: withCard });
    expect(there.result.code).toBe(0);
    const renamed = applied(withCard, there.writes);
    const back = applied(
      renamed,
      (await runEngine(["codemod", "rename", "OrderTile", "OrderCard"], { cwd: CWD, files: renamed })).writes,
    );
    const sort = (fs: Files): Files => [...fs].sort((a, b) => (a.path < b.path ? -1 : 1));
    expect(sort(back)).toEqual(sort(withCard));
  });

  it("operations route to their command; unknown ops; no op is an empty run", async () => {
    const io: Io = { cwd: CWD, files: [] };
    expect(lines((await runEngine(["scaffold", "rename", "A", "B"], io)).result.stdout)[0]).toBe(
      'E1052 unknown scaffold operation "rename"; it is keel codemod rename',
    );
    expect((await runEngine(["codemod"], io)).result.stdout).toBe("ok codemod 0 created, 0 changed, 0 removed\n");
  });
});

describe("build", () => {
  it("compiles the project and returns the .keel artifacts as read-only canonical writes", async () => {
    const files = await project();
    const e = await runEngine(["build"], { cwd: CWD, files });
    expect(e.result).toMatchObject({ code: 0 });
    expect(e.writes.map((w) => [w.path, w.readonly])).toEqual([
      [".keel/a11y.json", true],
      [".keel/deps.json", true],
      [".keel/ids.json", true],
      [".keel/styles.json", true],
    ]);
    for (const w of e.writes) expect(Object.keys(JSON.parse(w.content ?? "{}"))).toEqual(["data", "hash"]);
  });

  it("compiler errors flow through as diagnostics and nothing is written", async () => {
    const files = [
      { path: "src/C.tsx", source: `export default function C() { return <a href="javascript:alert(1)">x</a> }\n` },
    ];
    const e = await runEngine(["build"], { cwd: CWD, files });
    expect(e.result.code).toBe(1);
    expect(e.result.stdout).toMatch(/^E1003 src\/C\.tsx:/);
    expect(e.writes).toEqual([]);
  });
});
