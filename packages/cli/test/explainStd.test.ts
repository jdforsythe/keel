// k.check explain and docs: `keel explain` of a code a registered stdlib rule reports gives that rule's message and
// `explain`, as `keel check` loads the project's std deps. A stub `@keel/std-*` package in a real temp folder.
// Seed: 1337 (no generated inputs).
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, expect, test } from "vitest";
import { run } from "../src/run.ts";

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

const DEFINE = pathToFileURL(join(import.meta.dirname, "../../check/src/defineRule.ts")).href;
const RULE = `defineRule({ code: "E2998", message: "a stub rule's message", explain: "Why the stub rule fires.", check: () => [] });`;

/** A project whose module lists a stub `@keel/std-explainstub` whose `./tools` registers E2998. */
function project(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "keel-explain-std-")));
  made.push(root);
  const pkg = join(root, "stub");
  mkdirSync(pkg, { recursive: true });
  mkdirSync(join(root, "node_modules/@keel"), { recursive: true });
  mkdirSync(join(root, "modules/m"), { recursive: true });
  symlinkSync(pkg, join(root, "node_modules/@keel/std-explainstub"));
  writeFileSync(
    join(pkg, "package.json"),
    JSON.stringify({
      name: "@keel/std-explainstub",
      type: "module",
      exports: { ".": "./index.js", "./tools": "./tools.js" },
    }),
  );
  writeFileSync(join(pkg, "index.js"), "export {};\n");
  writeFileSync(join(pkg, "tools.js"), `import { defineRule } from ${JSON.stringify(DEFINE)};\n${RULE}\n`);
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fx", version: "1.0.0", type: "module" }));
  writeFileSync(
    join(root, "modules/m/module.ts"),
    "import { module } from '@keel/compiler'\nexport default module({ id: 'm', deps: ['@keel/std-explainstub'], capabilities: [], public: { exports: [] } })\n",
  );
  return root;
}

test("keel explain of a stdlib code the project's deps register gives the rule's message and explain", async () => {
  const root = project();
  const manifest = {
    path: "modules/m/module.ts",
    source:
      "import { module } from '@keel/compiler'\nexport default module({ id: 'm', deps: ['@keel/std-explainstub'], capabilities: [], public: { exports: [] } })\n",
  };
  // As the binary's io: files per scope, none for `explain` itself.
  const out = await run(["explain", "E2998"], { cwd: root, load: (scope) => (scope === "none" ? [] : [manifest]) });
  expect(out.stdout).toContain("E2998 a stub rule's message.");
  expect(out.stdout).toContain("Why the stub rule fires.");
  expect(out.code).toBe(0);
});
