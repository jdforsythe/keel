// E1585 through a symlink (k.shell Files): a target's `files` output is untrusted. A path whose target is a symlink,
// or whose nearest existing ancestor's real path is outside `deploy/<name>/<shell>/`, is E1585 and the deploy
// generator gets none of that set. Real temp folders and links; a stub `@keel/std-tauri/tools` registers the target.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import { linkEscapes } from "../src/internal/linkEscapes.ts";
import { shellTargets } from "../src/internal/shellTargets.ts";

const made: string[] = [];
const temp = (): string => {
  const d = realpathSync(mkdtempSync(join(tmpdir(), "keel-shell-links-")));
  made.push(d);
  return d;
};
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

const TOPOLOGY =
  "import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['c'], adapter: 'client', shells: { tauri: { id: 'dev.keel.a', name: 'A' } } },\n})\n";
const REGISTER = pathToFileURL(join(import.meta.dirname, "../src/shellTarget.ts")).href;

/**
 * A project whose stub `@keel/std-tauri/tools` registers a target giving `files`. The package folder is linked into
 * `node_modules`, so its real path is outside one and the test runner loads it with the registry the test reads.
 */
function project(files: Record<string, string>): { root: string; project: { path: string; source: string }[] } {
  const root = temp();
  const pkg = join(root, "stub");
  mkdirSync(pkg, { recursive: true });
  mkdirSync(join(root, "node_modules/@keel"), { recursive: true });
  symlinkSync(pkg, join(root, "node_modules/@keel/std-tauri"));
  writeFileSync(
    join(pkg, "package.json"),
    JSON.stringify({ name: "@keel/std-tauri", type: "module", exports: { "./tools": "./tools.js" } }),
  );
  writeFileSync(
    join(pkg, "tools.js"),
    `import { shellTarget } from ${JSON.stringify(REGISTER)};\nshellTarget("tauri", { platforms: [], files: () => (${JSON.stringify(files)}), tools: () => [], plugins: () => [], build: () => ({ artifact: "x" }), ci: () => [] });\n`,
  );
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fx", version: "1.0.0", type: "module" }));
  return { root, project: [{ path: "topology.ts", source: TOPOLOGY }] };
}

describe("linkEscapes", () => {
  test("a folder not yet made, under a real project, does not escape", () => {
    const root = temp();
    expect(linkEscapes(join(root, "deploy/web/tauri"), join(root, "deploy/web/tauri/src/main.rs"))).toBe(false);
  });

  test("a target that is a symlink escapes, even to a file inside the folder", () => {
    const root = temp();
    mkdirSync(join(root, "f"), { recursive: true });
    writeFileSync(join(root, "f/real.json"), "{}");
    symlinkSync(join(root, "f/real.json"), join(root, "f/a.json"));
    expect(linkEscapes(join(root, "f"), join(root, "f/a.json"))).toBe(true);
    expect(linkEscapes(join(root, "f"), join(root, "f/real.json"))).toBe(false);
  });

  test("an ancestor linked out of the folder escapes", () => {
    const root = temp();
    const away = temp();
    mkdirSync(join(root, "f"), { recursive: true });
    symlinkSync(away, join(root, "f/src"));
    expect(linkEscapes(join(root, "f"), join(root, "f/src/main.rs"))).toBe(true);
    expect(linkEscapes(join(root, "f"), join(root, "f/src/deeper/main.rs"))).toBe(true);
  });
});

describe("shellTargets: E1585 through a symlink", () => {
  test("a clean set is given whole and reports nothing", async () => {
    const fx = project({ "a.json": "{}", "src/b.rs": "" });
    const r = await shellTargets(fx.root, fx.project, undefined);
    expect(r.diags).toEqual([]);
    expect([...r.paths].sort()).toEqual(["deploy/web/tauri/a.json", "deploy/web/tauri/src/b.rs"]);
  });

  test("a shell folder subfolder linked out of the project is one E1585 and the set gives nothing", async () => {
    const fx = project({ "a.json": "{}", "src/b.rs": "" });
    mkdirSync(join(fx.root, "deploy/web/tauri"), { recursive: true });
    symlinkSync(temp(), join(fx.root, "deploy/web/tauri/src"));
    const r = await shellTargets(fx.root, fx.project, undefined);
    expect(r.diags.map((d) => d.code)).toEqual(["E1585"]);
    expect([...r.paths]).toEqual([]);
  });

  test("a shell folder that is itself a link out of the project is one E1585", async () => {
    const fx = project({ "a.json": "{}" });
    mkdirSync(join(fx.root, "deploy/web"), { recursive: true });
    symlinkSync(temp(), join(fx.root, "deploy/web/tauri"));
    const r = await shellTargets(fx.root, fx.project, undefined);
    expect(r.diags.map((d) => d.code)).toEqual(["E1585"]);
    expect([...r.paths]).toEqual([]);
  });

  test("a target path that is a symlink is one E1585", async () => {
    const fx = project({ "a.json": "{}" });
    mkdirSync(join(fx.root, "deploy/web/tauri"), { recursive: true });
    writeFileSync(join(fx.root, "elsewhere.json"), "{}");
    symlinkSync(join(fx.root, "elsewhere.json"), join(fx.root, "deploy/web/tauri/a.json"));
    const r = await shellTargets(fx.root, fx.project, undefined);
    expect(r.diags.map((d) => d.code)).toEqual(["E1585"]);
  });
});
