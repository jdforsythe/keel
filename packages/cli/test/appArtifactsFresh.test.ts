// The committed `.keel/` artifacts of the golden apps are what `keel build` writes (a stale surface is E1005 under
// `keel check`), and `keel test` leaves every one of them as committed (k.test-run Run report, k.compat Surface).
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { run } from "../src/index.ts";
import { linkedProject } from "./support/linkedProject.ts";

// Repo root via a workspace link, so this also holds in Stryker's sandbox copy (where ../../.. is not the repo root).
const PACKAGES = dirname(realpathSync(join(import.meta.dirname, "..", "node_modules", "@keel", "schema")));
const BIN = join(PACKAGES, "cli", "src", "bin.ts");
const APPS = ["golden-1", "sessions"];

/** Every file under the app's `.keel/` with its bytes, sorted by name. */
const artifacts = (dir: string): [string, string][] =>
  readdirSync(join(dir, ".keel"), { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e): [string, string] => [e.name, readFileSync(join(dir, ".keel", e.name), "utf8")])
    .sort(([a], [b]) => a.localeCompare(b));

const sources = (dir: string): { path: string; source: string }[] => {
  const walk = (at: string, rel: string): { path: string; source: string }[] =>
    readdirSync(at, { withFileTypes: true }).flatMap((e) => {
      const abs = join(at, e.name);
      const path = rel === "" ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory())
        return ["node_modules", "dist", ".keel", "coverage", "reports"].includes(e.name) ? [] : walk(abs, path);
      const code = /\.[cm]?[jt]sx?$/.test(e.name) && !/^(?:vite|vitest|stryker)\.config\./.test(e.name);
      return code ? [{ path, source: readFileSync(abs, "utf8") }] : [];
    });
  return walk(dir, "");
};

describe.each(APPS)("apps/%s .keel artifacts", (name) => {
  const app = join(PACKAGES, "..", "apps", name);
  const project = linkedProject(app);
  afterAll(project.remove);

  it("`keel check` finds the committed surface current (no E1005)", async () => {
    const r = await run(["check", "--format=json"], { cwd: project.root, files: sources(app) });
    expect(r.stdout.split("\n").filter((l) => l.includes('"E1005"'))).toEqual([]);
  });

  // A whole `keel test` of a golden app takes about 17 s alone: 480 s is 48 s at scale 0.1, under three times that.
  it("`keel test` leaves the committed `.keel/` files as they are", () => {
    const before = artifacts(app);
    const r = spawnSync(process.execPath, [BIN, "test"], { cwd: app, encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(artifacts(app)).toEqual(before);
  }, 480_000);
});
