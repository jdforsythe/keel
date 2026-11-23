// The registered shell target is held per `./tools` file, so per project root (k.shell Shell target): one process
// (an LSP or MCP) serving two projects whose shell packages differ reads each project's own target, and a package
// registering one shell twice reports E1053 (k.cli), not E1159. Stub packages in real temp folders.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import { shellTargets } from "../src/internal/shellTargets.ts";

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

const TOPOLOGY = {
  path: "topology.ts",
  source:
    "import { topology } from '@keel/server'\nexport default topology({\n  web: { modules: ['c'], adapter: 'client', shells: { tauri: { id: 'dev.keel.a', name: 'A' } } },\n})\n",
};
const REGISTER = pathToFileURL(join(import.meta.dirname, "../src/shellTarget.ts")).href;
const target = (file: string): string =>
  `{ platforms: [], files: () => ({ ${JSON.stringify(file)}: "{}" }), tools: () => [], plugins: () => [], build: () => ({ artifact: "x" }), ci: () => [] }`;

/**
 * A project whose stub `@keel/std-tauri/tools` runs `body`. The package folder is linked into `node_modules`, so its
 * real path is outside one and the test runner loads it with the registry the test reads.
 */
function project(body: string): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "keel-shell-slot-")));
  made.push(root);
  const pkg = join(root, "stub");
  mkdirSync(pkg, { recursive: true });
  mkdirSync(join(root, "node_modules/@keel"), { recursive: true });
  symlinkSync(pkg, join(root, "node_modules/@keel/std-tauri"));
  writeFileSync(
    join(pkg, "package.json"),
    JSON.stringify({ name: "@keel/std-tauri", type: "module", exports: { "./tools": "./tools.js" } }),
  );
  writeFileSync(join(pkg, "tools.js"), `import { shellTarget } from ${JSON.stringify(REGISTER)};\n${body}\n`);
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fx", version: "1.0.0", type: "module" }));
  return root;
}

describe("shellTargets: a target per project root", () => {
  test("two projects in one process each read their own target, again on a second load", async () => {
    const a = project(`shellTarget("tauri", ${target("a.json")});`);
    const b = project(`shellTarget("tauri", ${target("b.json")});`);
    const [ra, rb] = await Promise.all([
      shellTargets(a, [TOPOLOGY], undefined),
      shellTargets(b, [TOPOLOGY], undefined),
    ]);
    expect([ra.diags, rb.diags]).toEqual([[], []]);
    expect([...ra.paths]).toEqual(["deploy/web/tauri/a.json"]);
    expect([...rb.paths]).toEqual(["deploy/web/tauri/b.json"]);
    const again = await shellTargets(a, [TOPOLOGY], undefined);
    expect([...again.paths]).toEqual(["deploy/web/tauri/a.json"]);
  });

  test("a package registering tauri twice is one E1053, not E1159", async () => {
    const root = project(`shellTarget("tauri", ${target("a.json")});\nshellTarget("tauri", ${target("a.json")});`);
    const r = await shellTargets(root, [TOPOLOGY], undefined);
    expect(r.diags.map((d) => [d.code, d.message])).toEqual([
      ["E1053", "shell package @keel/std-tauri/tools registers its target twice"],
    ]);
  });

  test("a package that throws otherwise is E1159", async () => {
    const root = project(`throw new Error("boom");`);
    const r = await shellTargets(root, [TOPOLOGY], undefined);
    expect(r.diags.map((d) => d.code)).toEqual(["E1159"]);
  });
});
