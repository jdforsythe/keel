import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import nodePath from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type Files, apply } from "./helpers.ts";

// Repo root via a workspace link, so this also holds in Stryker's sandbox copy.
const REPO_ROOT = nodePath.resolve(
  fs.realpathSync(fileURLToPath(new URL("../node_modules/@keel/schema", import.meta.url))),
  "../..",
);
const BIN = nodePath.join(REPO_ROOT, "packages/cli/src/bin.ts");
const ADAPTERS = ["client", "node", "static"] as const;
const SCRIPTS = ["check", "test", "build"];

/** A fresh project on disk with the repo's packages and tools linked in, so its scripts resolve `keel`, `tsc` and `biome` as an install would. */
function onDisk(files: Files, dir: string): void {
  for (const [p, text] of files) {
    fs.mkdirSync(nodePath.dirname(nodePath.join(dir, p)), { recursive: true });
    fs.writeFileSync(nodePath.join(dir, p), text);
  }
  fs.copyFileSync(nodePath.join(REPO_ROOT, "biome.json"), nodePath.join(dir, "biome.json"));
  const mods = nodePath.join(dir, "node_modules");
  fs.mkdirSync(nodePath.join(mods, "@keel"), { recursive: true });
  fs.mkdirSync(nodePath.join(mods, "@types"));
  fs.mkdirSync(nodePath.join(mods, ".bin"));
  for (const pkg of fs.readdirSync(nodePath.join(REPO_ROOT, "packages")))
    fs.symlinkSync(nodePath.join(REPO_ROOT, "packages", pkg), nodePath.join(mods, "@keel", pkg));
  fs.symlinkSync(nodePath.join(REPO_ROOT, "tooling"), nodePath.join(mods, "@keel/tooling"));
  fs.mkdirSync(nodePath.join(mods, "@biomejs"));
  for (const dep of ["vitest", "vite", "happy-dom", "typescript", "@biomejs/biome"])
    fs.symlinkSync(nodePath.join(REPO_ROOT, "node_modules", dep), nodePath.join(mods, dep));
  fs.symlinkSync(
    fs.realpathSync(fileURLToPath(new URL("../node_modules/@types/node", import.meta.url))),
    nodePath.join(mods, "@types/node"),
  );
  for (const tool of ["tsc", "biome"])
    fs.symlinkSync(nodePath.join(REPO_ROOT, "node_modules/.bin", tool), nodePath.join(mods, ".bin", tool));
  const shim = nodePath.join(mods, ".bin/keel");
  fs.writeFileSync(shim, `#!/bin/sh\nexec "${process.execPath}" --disable-warning=ExperimentalWarning "${BIN}" "$@"\n`);
  fs.chmodSync(shim, 0o755);
}

/** Runs a script of the project's `package.json` as written, the way `pnpm <name>` does. */
function script(dir: string, name: string): { status: number | null; out: string } {
  const pkg: { scripts: Record<string, string> } = JSON.parse(
    fs.readFileSync(nodePath.join(dir, "package.json"), "utf8"),
  );
  const line = pkg.scripts[name];
  if (line === undefined) return { status: null, out: `no script ${name}` };
  const env = { ...process.env, PATH: `${nodePath.join(dir, "node_modules/.bin")}:${process.env.PATH ?? ""}` };
  const run = spawnSync("sh", ["-c", line], { cwd: dir, encoding: "utf8", env });
  return { status: run.status, out: `${run.stdout}${run.stderr}` };
}

describe("a fresh scaffold passes its own scripts untouched", () => {
  for (const workspace of [true, false])
    for (const adapter of ADAPTERS)
      it(`${workspace ? "workspace" : "standalone"} ${adapter}: its scripts exit 0`, () => {
        // A workspace project lives inside the repo (its vite serves the repo's tooling); a standalone one stands alone.
        const parent = workspace ? nodePath.join(REPO_ROOT, ".fixtures") : os.tmpdir();
        fs.mkdirSync(parent, { recursive: true });
        const dir = fs.mkdtempSync(nodePath.join(parent, "keel-scaffold-first-"));
        try {
          onDisk(apply("project", { name: "shop", adapter, workspace }, new Map()), dir);
          const pkg = JSON.parse(fs.readFileSync(nodePath.join(dir, "package.json"), "utf8"));
          expect(pkg.devDependencies["@keel/cli"]).toBeDefined();
          expect(pkg.scripts.check).toContain("keel check");
          const results = SCRIPTS.map((n) => ({ n, ...script(dir, n) }));
          expect(
            results.map((r) => (r.status === 0 ? `${r.n} 0` : `${r.n} ${r.status}\n${r.out.slice(-1500)}`)),
          ).toEqual(SCRIPTS.map((n) => `${n} 0`));
        } finally {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      }, 240_000);
});
