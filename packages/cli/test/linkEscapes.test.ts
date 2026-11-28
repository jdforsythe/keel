// k.scaffold Links: what `linkEscapes` judges, behind E1357 (`applyWrites`) and E1585 (`shellTargets`). Real temporary
// folders and links under the system temp folder; `<parent>/proj` is the root and `<parent>/proj-evil` its sibling.
import { chmodSync, linkSync, lstatSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { linkEscapes } from "@keel/scaffold/links";
import { tempDir } from "@keel/tooling/test-tmp";
import fc from "fast-check";
import { afterEach, describe, expect, test, vi } from "vitest";
import { applyWrites } from "../src/internal/applyWrites.ts";
import { shellTargets } from "../src/internal/shellTargets.ts";

vi.mock("@keel/scaffold/links", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@keel/scaffold/links")>();
  return { linkEscapes: vi.fn(actual.linkEscapes) };
});

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
  vi.mocked(linkEscapes).mockClear();
});

/** `<parent>/proj` and `<parent>/proj-evil`, both real paths. */
function layout(): { parent: string; proj: string; evil: string } {
  const parent = realpathSync(tempDir("keel-link-escapes-"));
  made.push(parent);
  const proj = join(parent, "proj");
  const evil = join(parent, "proj-evil");
  mkdirSync(proj);
  mkdirSync(evil);
  return { parent, proj, evil };
}

describe("linkEscapes", () => {
  test("a plain path inside the root, made or not yet made, does not escape", () => {
    const { proj } = layout();
    writeFileSync(join(proj, "a.txt"), "a");
    expect(linkEscapes(proj, join(proj, "a.txt"))).toBe(false);
    expect(linkEscapes(proj, join(proj, "new/deeper/b.txt"))).toBe(false);
  });

  test("a sibling whose name has the root as a prefix is outside it", () => {
    const { proj, evil } = layout();
    expect(linkEscapes(proj, join(evil, "a.txt"))).toBe(true);
    symlinkSync("../proj-evil", join(proj, "rel"));
    expect(linkEscapes(proj, join(proj, "rel/a.txt"))).toBe(true);
    symlinkSync(evil, join(proj, "abs"));
    expect(linkEscapes(proj, join(proj, "abs/new/a.txt"))).toBe(true);
  });

  test("a link to an ancestor of the root escapes", () => {
    const { parent, proj } = layout();
    symlinkSync(parent, join(proj, "up"));
    expect(linkEscapes(proj, join(proj, "up/a.txt"))).toBe(true);
    symlinkSync("..", join(proj, "dots"));
    expect(linkEscapes(proj, join(proj, "dots/proj-evil/a.txt"))).toBe(true);
  });

  test("a chain of links is followed to its end: out escapes, back inside is followed", () => {
    const { proj, evil } = layout();
    mkdirSync(join(proj, "home"));
    symlinkSync(evil, join(proj, "hop-out"));
    symlinkSync(join(proj, "hop-out"), join(proj, "out"));
    symlinkSync(join(proj, "home"), join(proj, "hop-in"));
    symlinkSync(join(proj, "hop-in"), join(proj, "in"));
    expect(linkEscapes(proj, join(proj, "out/a.txt"))).toBe(true);
    expect(linkEscapes(proj, join(proj, "in/a.txt"))).toBe(false);
  });

  test("a dangling intermediate folder counts as outside", () => {
    const { proj } = layout();
    symlinkSync(join(proj, "missing"), join(proj, "dangling"));
    expect(linkEscapes(proj, join(proj, "dangling/a.txt"))).toBe(true);
    expect(linkEscapes(proj, join(proj, "dangling/deeper/a.txt"))).toBe(true);
  });

  test("a folder link that resolves back inside is followed; a target that is itself a link escapes", () => {
    const { proj } = layout();
    mkdirSync(join(proj, "home"));
    writeFileSync(join(proj, "home/real.txt"), "r");
    symlinkSync(join(proj, "home"), join(proj, ".claude"));
    expect(linkEscapes(proj, join(proj, ".claude/a.txt"))).toBe(false);
    symlinkSync(join(proj, "home/real.txt"), join(proj, "file-link.txt"));
    expect(linkEscapes(proj, join(proj, "file-link.txt"))).toBe(true);
  });

  test("a root reached through a link is judged by its real path", () => {
    const { parent, proj, evil } = layout();
    const via = join(parent, "via");
    symlinkSync(proj, via);
    mkdirSync(join(proj, "home"));
    symlinkSync(join(proj, "home"), join(proj, "in"));
    symlinkSync(evil, join(proj, "out"));
    expect(linkEscapes(proj, join(via, "in/a.txt"))).toBe(false);
    expect(linkEscapes(proj, join(via, "a.txt"))).toBe(false);
    expect(linkEscapes(proj, join(via, "out/a.txt"))).toBe(true);
  });

  test.runIf(realpathSync("/tmp") !== "/tmp")(
    "the system `/tmp` reached through its link is judged by its real path",
    () => {
      const dir = tempDir("keel-link-escapes-", "/tmp");
      made.push(dir);
      expect(linkEscapes(realpathSync(dir), join(dir, "a.txt"))).toBe(false);
      expect(linkEscapes(dir, join(dir, "a.txt"))).toBe(true);
    },
  );

  test("a root that is not a real path makes every target escape", () => {
    const { parent, proj } = layout();
    const via = join(parent, "via");
    symlinkSync(proj, via);
    for (const t of [join(via, "a.txt"), join(proj, "a.txt"), join(via, "new/b.txt"), via])
      expect(linkEscapes(via, t)).toBe(true);
    expect(linkEscapes("proj", join(proj, "a.txt"))).toBe(true);
    symlinkSync(join(parent, "missing"), join(parent, "dangling"));
    expect(linkEscapes(join(parent, "dangling"), join(parent, "dangling/a.txt"))).toBe(true);
  });

  test("an existing file with more than one hard link escapes, its other name inside the project or outside", () => {
    const { proj, evil } = layout();
    writeFileSync(join(evil, "outside.md"), "o");
    linkSync(join(evil, "outside.md"), join(proj, "AGENTS.md"));
    expect(linkEscapes(proj, join(proj, "AGENTS.md"))).toBe(true);
    writeFileSync(join(proj, "twin.md"), "t");
    linkSync(join(proj, "twin.md"), join(proj, "other.md"));
    expect(linkEscapes(proj, join(proj, "twin.md"))).toBe(true);
    expect(linkEscapes(proj, join(proj, "other.md"))).toBe(true);
    rmSync(join(proj, "other.md"));
    expect(linkEscapes(proj, join(proj, "twin.md"))).toBe(false);
  });

  test.runIf(process.getuid?.() !== 0)("an ancestor that cannot be read counts as outside", () => {
    const { proj } = layout();
    mkdirSync(join(proj, "locked"));
    chmodSync(join(proj, "locked"), 0o000);
    try {
      expect(linkEscapes(proj, join(proj, "locked/a.txt"))).toBe(true);
      expect(linkEscapes(proj, join(proj, "locked/deeper/a.txt"))).toBe(true);
    } finally {
      chmodSync(join(proj, "locked"), 0o755);
    }
  });

  test("a folder is not judged by its link count", () => {
    const { proj } = layout();
    mkdirSync(join(proj, "d/e/f"), { recursive: true });
    expect(lstatSync(join(proj, "d")).nlink).toBeGreaterThan(1);
    expect(linkEscapes(proj, join(proj, "d/a.txt"))).toBe(false);
  });
});

/** Whether `abs` is inside folder `real` by segment, `real` itself excluded. */
const inside = (real: string, abs: string): boolean => {
  const rel = relative(real, abs);
  return rel !== "" && rel.split(/[\\/]/)[0] !== ".." && !isAbsolute(rel);
};

type Entry = { readonly kind: "dir" | "link" | "file" | "hard"; readonly at: readonly string[]; readonly to: number };
const SEG = fc.constantFrom("a", "b", "c");
const ENTRY = fc.record({
  kind: fc.constantFrom<Entry["kind"]>("dir", "link", "file", "hard"),
  at: fc.array(SEG, { minLength: 1, maxLength: 2 }),
  to: fc.nat({ max: 6 }),
});

describe("linkEscapes, property", () => {
  test("a target judged not to escape is written inside the root; one judged to escape is a link, a hard link, unreachable or outside", () => {
    fc.assert(
      fc.property(fc.array(ENTRY, { maxLength: 5 }), fc.array(SEG, { maxLength: 2 }), (entries, at) => {
        const { parent, proj, evil } = layout();
        writeFileSync(join(evil, "f.txt"), "outside");
        const aims = [
          join(proj, "a"),
          join(proj, "b/c"),
          evil,
          join(evil, "a"),
          join(parent, "missing"),
          parent,
          "../proj-evil",
        ];
        for (const e of entries) {
          const p = join(proj, ...e.at);
          try {
            mkdirSync(dirname(p), { recursive: true });
            if (e.kind === "dir") mkdirSync(p, { recursive: true });
            else if (e.kind === "link") symlinkSync(aims[e.to] ?? evil, p);
            else if (e.kind === "file") writeFileSync(join(p, "f.txt"), "inside");
            else linkSync(join(evil, "f.txt"), join(p, "f.txt"));
          } catch {
            // A shape the earlier entries made impossible; the layout stays as it is.
          }
        }
        const target = join(proj, ...at, "f.txt");
        const judged = linkEscapes(proj, target);
        const st = (() => {
          try {
            return lstatSync(target);
          } catch {
            return undefined;
          }
        })();
        if (st?.isSymbolicLink() === true || (st !== undefined && st.nlink > 1)) {
          expect(judged).toBe(true);
          return;
        }
        let lands: string | undefined;
        try {
          mkdirSync(dirname(target), { recursive: true });
          lands = join(realpathSync(dirname(target)), basename(target));
        } catch {
          lands = undefined;
        }
        if (!judged) {
          expect(lands).toBeDefined();
          expect(inside(proj, lands ?? parent)).toBe(true);
        } else expect(lands === undefined || !inside(proj, lands)).toBe(true);
      }),
      { seed: 1357, numRuns: 60 },
    );
  });
});

const TOPOLOGY =
  "import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['c'], adapter: 'client', shells: { tauri: { id: 'dev.keel.a', name: 'A' } } },\n})\n";
const REGISTER = pathToFileURL(join(import.meta.dirname, "../src/shellTarget.ts")).href;

describe("the callers judge against a real path", () => {
  test("`applyWrites` passes the real path of the project root, reached through a link", () => {
    const { parent, proj } = layout();
    const via = join(parent, "via");
    symlinkSync(proj, via);
    applyWrites(via, [{ path: "a.txt", content: "a", readonly: false }]);
    const roots = vi.mocked(linkEscapes).mock.calls.map((c) => c[0]);
    expect(roots).toEqual([proj]);
    expect(roots.every((r) => realpathSync(r) === r)).toBe(true);
  });

  test("`shellTargets` passes the real path of the project root joined with `deploy/<name>/<shell>`", async () => {
    const { parent, proj } = layout();
    const pkg = join(proj, "stub");
    mkdirSync(pkg);
    mkdirSync(join(proj, "node_modules/@keel"), { recursive: true });
    symlinkSync(pkg, join(proj, "node_modules/@keel/std-tauri"));
    writeFileSync(
      join(pkg, "package.json"),
      JSON.stringify({ name: "@keel/std-tauri", type: "module", exports: { "./tools": "./tools.js" } }),
    );
    writeFileSync(
      join(pkg, "tools.js"),
      `import { shellTarget } from ${JSON.stringify(REGISTER)};\nshellTarget("tauri", { platforms: [], files: () => ({ "a.json": "{}" }), tools: () => [], plugins: () => [], build: () => ({ artifact: "x" }), ci: () => [] });\n`,
    );
    writeFileSync(join(proj, "package.json"), JSON.stringify({ name: "fx", version: "1.0.0", type: "module" }));
    const via = join(parent, "via");
    symlinkSync(proj, via);
    const r = await shellTargets(via, [{ path: "topology.ts", source: TOPOLOGY }], undefined);
    expect(r.diags).toEqual([]);
    const roots = new Set(vi.mocked(linkEscapes).mock.calls.map((c) => c[0]));
    expect([...roots]).toEqual([join(proj, "deploy/web/tauri")]);
  });
});
