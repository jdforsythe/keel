// Spec: k.create-folder Not done and its permission-model clause: what the bin reads above the folder is exactly, in each
// folder above it, `package.json`, `pnpm-workspace.yaml`, `node_modules/@keel/cli/package.json` and `.git`. The built bin
// runs under `node --permission` with reads granted to its own package, the folder and its contents and those four names
// in each ancestor alone, for each kind and inside a workspace: exit 0 is the proof, since a refused read throws.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { testTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import { beforeAll, describe, expect, it } from "vitest";

const PKG = fileURLToPath(new URL("..", import.meta.url));
const BIN = join(PKG, "dist/bin.js");
const NAMES = ["package.json", "pnpm-workspace.yaml", "node_modules/@keel/cli/package.json", ".git"];

/** The grant the clause names for a run in `cwd` writing `folder` (absolute). */
function grant(folder: string): string[] {
  const above: string[] = [];
  for (let at = dirname(folder); ; at = dirname(at)) {
    above.push(at);
    if (dirname(at) === at) break;
  }
  return [
    "--permission",
    `--allow-fs-read=${PKG}`,
    `--allow-fs-read=${PKG}*`,
    `--allow-fs-read=${folder}`,
    `--allow-fs-read=${folder}/*`,
    ...above.flatMap((a) => NAMES.map((n) => `--allow-fs-read=${join(a, n)}`)),
    `--allow-fs-write=${folder}`,
    `--allow-fs-write=${folder}/*`,
  ];
}

const create = (cwd: string, folder: string, args: string[], limited = true) =>
  spawnSync(process.execPath, [...(limited ? grant(join(cwd, folder)) : []), BIN, folder, ...args, "--format=json"], {
    cwd,
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "", npm_config_user_agent: "pnpm/9.12.0 node/v22.15.0" },
    timeout: testTime(30_000),
  });

describe("create-app under node --permission with reads limited to what the spec names", () => {
  beforeAll(() => {
    const b = spawnSync(process.execPath, [join(PKG, "build.mjs")], { encoding: "utf8", timeout: testTime(60_000) });
    expect(b.status, b.stderr).toBe(0);
  }, testTime(90_000));

  it(
    "each kind exits 0 and prints what an unlimited run prints (a read refused and caught would change it)",
    () => {
      for (const kind of [[], ["--adapter", "static"], ["--adapter", "node"], ["--library", "@acme/charts"]]) {
        const cwd = realpathSync(tempDir("keel-createperm-"));
        const r = create(cwd, "shop", kind);
        expect(r.status, `${kind.join(" ")}\n${r.stdout}${r.stderr}`).toBe(0);
        expect(readdirSync(join(cwd, "shop"))).toContain("package.json");
        const free = create(realpathSync(tempDir("keel-createperm-")), "shop", kind, false);
        expect(r.stdout).toBe(free.stdout);
      }
    },
    testTime(120_000),
  );

  it(
    "inside a workspace, with its root's files and an installed @keel/cli above, it exits 0",
    () => {
      const root = realpathSync(tempDir("keel-createperm-"));
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n");
      writeFileSync(join(root, "package.json"), '{ "name": "ws", "private": true }\n');
      mkdirSync(join(root, ".git"));
      mkdirSync(join(root, "node_modules/@keel/cli"), { recursive: true });
      const own: unknown = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8"));
      const version = typeof own === "object" && own !== null ? String(Reflect.get(own, "version")) : "";
      writeFileSync(join(root, "node_modules/@keel/cli/package.json"), JSON.stringify({ name: "@keel/cli", version }));
      mkdirSync(join(root, "apps"));
      const r = create(root, "apps/b", []);
      expect(r.status, r.stdout + r.stderr).toBe(0);
      expect(r.stdout).not.toContain("git init");
      expect(readdirSync(join(root, "apps/b"))).not.toContain("turbo.json");
    },
    testTime(60_000),
  );
});
