// Spec: std.report, clause "`@keel/std-report` bundled alone for a browser (esbuild, `bundle`, `platform: 'browser'`, nothing external) builds, and every input of the bundle is a file under `packages/std-report/` or `packages/schema/`."
// Seed 1337 (no random inputs)
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { expect, test } from "vitest";

const pkgs = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("`@keel/std-report` bundled alone for a browser (esbuild, `bundle`, `platform: 'browser'`, nothing external) builds, and every input of the bundle is a file under `packages/std-report/` or `packages/schema/`.", async () => {
  const result = await build({
    stdin: { contents: "export * from '@keel/std-report'", resolveDir: path.join(pkgs, "std-report"), loader: "ts" },
    absWorkingDir: path.resolve(pkgs, ".."),
    bundle: true,
    platform: "browser",
    format: "esm",
    metafile: true,
    write: false,
    logLevel: "silent",
    external: [],
  });
  expect(result.errors).toEqual([]);
  const inputs = Object.keys(result.metafile.inputs).filter((f) => f !== "<stdin>");
  expect(inputs.length).toBeGreaterThan(0);
  const roots = [path.join(pkgs, "std-report") + path.sep, path.join(pkgs, "schema") + path.sep];
  const root = path.resolve(pkgs, "..");
  for (const f of inputs) {
    const abs = path.resolve(root, f);
    expect(
      roots.some((r) => abs.startsWith(r)),
      `${f} is outside packages/std-report and packages/schema`,
    ).toBe(true);
  }
});
