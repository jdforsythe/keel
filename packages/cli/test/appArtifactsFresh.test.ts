// The committed derived files of the golden apps are their derivation (k.derived Frozen, Version control): `keel check
// --frozen` in the app finds no E1005 and writes nothing, and a frozen `keel test` leaves `.keel/` as it was.
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fixedTime } from "@keel/tooling/test-time";
import { describe, expect, it } from "vitest";

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

/** A child's end and its last lines, on one line (the reporter prints a message's first line). */
const ending = (r: ReturnType<typeof spawnSync>): string => {
  const out = `${String(r.stdout)}\n${String(r.stderr)}`
    .split("\n")
    .filter((l) => l.trim() !== "")
    .join(" | ");
  return `child exit ${r.status} signal ${r.signal}: ${out.length > 440 ? `...${out.slice(-440)}` : out}`;
};

describe.each(APPS)("apps/%s derived files", (name) => {
  const app = join(PACKAGES, "..", "apps", name);

  it(
    "`keel check --frozen` finds the committed surface and deploy files current (no E1005) and writes nothing",
    () => {
      const before = artifacts(app);
      const r = spawnSync(process.execPath, [BIN, "check", "--frozen", "--format=json"], {
        cwd: app,
        encoding: "utf8",
      });
      expect(
        r.stdout.split("\n").filter((l) => l.includes('"E1005"')),
        ending(r),
      ).toEqual([]);
      expect(artifacts(app)).toEqual(before);
    },
    fixedTime(240_000),
  );

  // A whole `keel test` of a golden app takes about 17 s alone: 480 s is 48 s at scale 0.1, under three times that.
  it(
    "a frozen `keel test` leaves `.keel/` as it was",
    () => {
      const before = artifacts(app);
      const r = spawnSync(process.execPath, [BIN, "test", "--frozen"], { cwd: app, encoding: "utf8" });
      expect(r.status, ending(r)).toBe(0);
      expect(artifacts(app)).toEqual(before);
    },
    fixedTime(480_000),
  );
});
