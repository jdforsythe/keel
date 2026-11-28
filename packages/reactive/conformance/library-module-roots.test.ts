// @vitest-environment node
// Spec: k.reactive, clause "In a library package's own folder (`\"keel\": \"library\"` in its `package.json`) under `keelConfig`, a `src` module whose top level is `export const r = owner()` gives `r` a scope whose `parent` is undefined, and a test file there whose top level is `const t = owner()` gives `t` undefined."
// Seed 1337 (no generated inputs: one fixture).
// Method: a child `vitest run` under `keelConfig` in a folder whose `package.json` has `"keel": "library"`, holding `src/mod.ts` (`export const r = owner()`) and a test file (`const t = owner()`); the fixture test writes what it saw to a file the outer test reads. The fixture folder is made inside this package so `@keel/reactive` and `@keel/tooling` resolve.
import { fixedTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";

const run = promisify(execFile);
const pkg = join(import.meta.dirname, "..");
const vitestBin = join(pkg, "..", "..", "node_modules", ".bin", "vitest");

it(
  'in a library package\'s own folder (`"keel": "library"` in its `package.json`) under `keelConfig`, a `src` module whose top level is `export const r = owner()` gives `r` a scope whose `parent` is undefined, and a test file there whose top level is `const t = owner()` gives `t` undefined',
  async () => {
    const dir = tempDir(".tmp-library-roots-", pkg);
    mkdirSync(join(dir, "src"));
    // The folder's own `package.json` names it, so `@keel/reactive` is found through its `node_modules`, as a library installs it.
    mkdirSync(join(dir, "node_modules", "@keel"), { recursive: true });
    symlinkSync(pkg, join(dir, "node_modules", "@keel", "reactive"));
    const out = join(dir, "seen.json");
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "@acme/roots", version: "0.0.0", type: "module", keel: "library" }),
    );
    writeFileSync(join(dir, "src", "mod.ts"), `import { owner } from "@keel/reactive";\nexport const r = owner();\n`);
    writeFileSync(
      join(dir, "a.test.ts"),
      `import { owner } from "@keel/reactive";
import { writeFileSync } from "node:fs";
import { test } from "vitest";
import { r } from "./src/mod.ts";
const t = owner();
test("seen", () => {
  writeFileSync(process.env.KEEL_ROOTS_OUT ?? "", JSON.stringify({
    rIsScope: r !== undefined && typeof r.dispose === "function",
    rParentUndefined: r !== undefined && r.parent === undefined,
    tUndefined: t === undefined,
  }));
});
`,
    );
    writeFileSync(
      join(dir, "vitest.config.ts"),
      `import { keelConfig } from "@keel/tooling/vitest-config";
export default keelConfig({ test: { include: ["*.test.ts"], environment: "node" } });
`,
    );
    await run(vitestBin, ["run", "--config", join(dir, "vitest.config.ts"), "--root", dir], {
      cwd: dir,
      env: { ...process.env, KEEL_ROOTS_OUT: out },
      timeout: fixedTime(120_000),
    }).catch((e: unknown) => {
      const text =
        typeof e === "object" && e !== null && "stdout" in e
          ? `${String(e.stdout)}${"stderr" in e ? String(e.stderr) : ""}`
          : String(e);
      throw new Error(`child vitest failed: ${text.slice(0, 3000)}`);
    });
    expect(JSON.parse(readFileSync(out, "utf8"))).toEqual({
      rIsScope: true,
      rParentUndefined: true,
      tUndefined: true,
    });
  },
  fixedTime(150_000),
);
