// Seed 1337
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stdRoutes } from "@keel/compiler/std/stdRoutes";
import { afterEach, expect, test } from "vitest";

const pkg = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmps: string[] = [];
afterEach(() => {
  for (const d of tmps.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

/** A project whose one app module lists `deps`, with this package linked into its `node_modules`. */
function project(deps: readonly string[]): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "keel-health-placed-"));
  tmps.push(root);
  fs.mkdirSync(path.join(root, "modules/app"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "modules/app/module.ts"),
    `import { module } from '@keel/compiler'\nexport default module(${JSON.stringify({
      id: "app",
      deps,
      capabilities: [],
      public: { exports: [], routes: [] },
    })})\n`,
  );
  fs.mkdirSync(path.join(root, "node_modules/@keel"), { recursive: true });
  fs.symlinkSync(pkg, path.join(root, "node_modules/@keel/std-health"));
  return root;
}

test("a deployable that places `health` gets the package's routes file for its route table", () => {
  const found = stdRoutes(project(["@keel/std-health"]), "health");
  expect(found).toEqual([path.join(pkg, "src/routes.ts"), pkg, "@keel/std-health/routes"]);
});

test("without the package in an app module's deps, `health` names no routes", () => {
  expect(stdRoutes(project([]), "health")).toBeUndefined();
});
