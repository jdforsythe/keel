// keel scaffold / codemod over io.files through @keel/scaffold; keel build through @keel/compiler.
import { describe, expect, it } from "vitest";
import { diffEdits } from "../src/internal/diffEdits.ts";
import { runEngine } from "../src/internal/runEngine.ts";
import type { Io } from "../src/types/Io.ts";
import { applyEdits } from "./support/applyEdits.ts";
import { linkedProject } from "./support/linkedProject.ts";

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
/** `scaffold project shop` writes under `shop/` (rfc:0068); later ops run inside it (`CWD`), so the prefix is dropped. */
const inShop = (writes: readonly { path: string; content: string | null }[]) =>
  writes.map((w) => ({ ...w, path: w.path.replace(/^shop\//, "") }));
const project = async (): Promise<Files> =>
  applied([], inShop((await runEngine(["scaffold", "project", "shop"], { cwd: "/work" })).writes));

describe("scaffold and codemod", () => {
  it("scaffold project lists the created files and returns them as writes under <name>/ (rfc:0068)", async () => {
    const e = await runEngine(["scaffold", "project", "shop"], { cwd: "/work", files: [] });
    expect(e.result.code).toBe(0);
    expect(lines(e.result.stdout)).toContain("create shop/topology.ts");
    expect(lines(e.result.stdout).at(-1)).toMatch(/^ok scaffold project \d+ created, 0 changed, 0 removed$/);
    expect(e.writes.map((w) => w.path)).toContain("shop/topology.ts");
    expect(e.writes.every((w) => w.path.startsWith("shop/"))).toBe(true);
    // A tree already holding shop/ is refused at shop/package.json; files beside it do not count.
    const again = await runEngine(["scaffold", "project", "shop"], {
      cwd: "/work",
      files: [{ path: "/work/shop/package.json", source: "{}" }],
    });
    expect(again.result.stdout).toContain("shop/package.json");
    expect(again.writes).toEqual([]);
    const beside = await runEngine(["scaffold", "project", "shop"], {
      cwd: "/work",
      files: [{ path: "/work/package.json", source: "{}" }],
    });
    expect(beside.result.code).toBe(0);
  });

  it("scaffold project accepts --workspace and --adapter and emits the workspace files and .gitignore", async () => {
    const e = await runEngine(["scaffold", "project", "shop", "--workspace", "--adapter", "node"], {
      cwd: "/work",
      files: [],
    });
    expect(e.result.code).toBe(0);
    const paths = e.writes.map((w) => w.path);
    expect(paths).toContain("shop/vitest.config.ts");
    expect(paths).not.toContain("shop/turbo.json");
    const ignore = e.writes.find((w) => w.path === "shop/.gitignore")?.content ?? "";
    expect(ignore.split("\n")).toEqual(
      expect.arrayContaining(["dist", ".turbo", "coverage", "reports", ".stryker-tmp", ".keel/sessions/"]),
    );
    expect(ignore.split("\n")).not.toContain(".keel");
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
    // `keel build` checks first: the project's imports resolve from an app of this repo, as from an installed one, from
    // a stand-in root, so the check's type cache is never written into the app.
    const linked = linkedProject(new URL("../../../apps/golden-2", import.meta.url).pathname);
    const e = await runEngine(["build"], { cwd: linked.root, files }).finally(linked.remove);
    expect(e.result, e.result.stdout).toMatchObject({ code: 0 });
    expect(e.writes.map((w) => [w.path, w.readonly])).toEqual([
      [".keel/a11y.json", true],
      [".keel/deps.json", true],
      [".keel/ids.json", true],
      [".keel/styles.json", true],
      [".keel/std.json", true],
      [".keel/schemes.json", true],
    ]);
    for (const w of e.writes) expect(Object.keys(JSON.parse(w.content ?? "{}"))).toEqual(["data", "hash"]);
  });

  it("compiler errors flow through as diagnostics and nothing is written", async () => {
    const files = [
      { path: "src/C.tsx", source: `export default function C() { return <a href="javascript:alert(1)">x</a> }\n` },
    ];
    const e = await runEngine(["build"], { cwd: CWD, files });
    expect(e.result.code).toBe(1);
    expect(e.result.stdout).toMatch(/^E1003 src\/C\.tsx:/m);
    expect(e.writes).toEqual([]);
  });
});
