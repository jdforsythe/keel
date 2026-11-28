// Spec: std.tauri, clause "`keel scaffold shell tauri` writes `@tauri-apps/cli` into `devDependencies` at the version `@keel/std-tauri`'s `package.json` `peerDependencies` hold, which is exact; after the install and `keel build`, `keel check` reports no diagnostic and `keel build --target tauri` with every native tool present prints no E1572, E1574 or E1575."
// std.tauri, App packages "in `devDependencies`, `@tauri-apps/cli` at the exact version this package's `package.json` `peerDependencies` hold, marked optional in `peerDependenciesMeta`. Nothing in `dependencies`."
// Seed: 1337 (no generated input: one fixed project).
// Fake tools (as build-tools.test.ts): `PATH` holds a `cargo`, a `rustc`, a `pkg-config` and an `npx` written by the test; the fake `npx` hands `vite` to the real `npx` and answers `tauri`.
// The install is simulated: `node_modules/@tauri-apps/cli` and `.bin/tauri` are written from the versions the scaffold wrote. No real native toolchain runs.
// ASSUMED: `scaffold("shell", ...)` takes `{ shell, id }` over a file map and `scaffold("project", { name, workspace: true })` writes `package.json` and `topology.ts` at the map's root, as `@keel/scaffold`'s own conformance uses them.
import { testTime } from "@keel/tooling/test-time";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scaffold } from "@keel/scaffold";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { type Rec, cleanup, materialize } from "./compat-support.ts";

const SLOW = 300_000;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");

type Files = Map<string, string>;
type Result = { ok: true; value: { files: Files } } | { ok: false; error: unknown };
/** `Op` does not name `shell` until it is built, so the call goes through `Reflect.apply`. */
const run = (op: string, input: Record<string, unknown>, files: Files): Result =>
  Reflect.apply(scaffold, undefined, [op, input, files]);

function app(): Files {
  const project = run("project", { name: "fx", workspace: true }, new Map());
  if (!project.ok) throw new Error(JSON.stringify(project.error));
  const out = run("shell", { shell: "tauri", id: "dev.keel.golden" }, project.value.files);
  if (!out.ok) throw new Error(`scaffold shell tauri failed: ${JSON.stringify(out.error)}`);
  return out.value.files;
}

function obj(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? Object.fromEntries(Object.entries(v)) : {};
}
const stdPackage = (): Record<string, unknown> =>
  obj(JSON.parse(readFileSync(join(REPO, "packages", "std-tauri", "package.json"), "utf8")));
const written = (files: Files): Record<string, unknown> => obj(JSON.parse(files.get("package.json") ?? "null"));

let project = "";
let scratch = "";
let realNpx = "";
let scaffolded: Files = new Map();
beforeAll(() => {
  scaffolded = app();
  project = materialize(Object.fromEntries(scaffolded));
  const cli = obj(written(scaffolded).devDependencies)["@tauri-apps/cli"];
  mkdirSync(join(project, "node_modules", "@tauri-apps", "cli"), { recursive: true });
  writeFileSync(
    join(project, "node_modules", "@tauri-apps", "cli", "package.json"),
    `${JSON.stringify({ name: "@tauri-apps/cli", version: String(cli) })}\n`,
  );
  mkdirSync(join(project, "node_modules", ".bin"), { recursive: true });
  symlinkSync(join(REPO, "node_modules", "vite", "bin", "vite.js"), join(project, "node_modules", ".bin", "vite"));
  exe(join(project, "node_modules", ".bin", "tauri"), "exit 0\n");
  scratch = mkdtempSync(join(tmpdir(), "keel-shell-app-"));
  for (const d of (process.env.PATH ?? "").split(delimiter)) {
    if (d !== "" && existsSync(join(d, "npx"))) {
      realNpx = join(d, "npx");
      break;
    }
  }
}, SLOW);
afterAll(() => {
  cleanup(project);
  rmSync(scratch, { recursive: true, force: true });
});

function exe(path: string, body: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `#!/bin/sh\n${body}`);
  chmodSync(path, 0o755);
}

/** The environment with every native tool present, as fakes. */
function toolsEnv(): Record<string, string> {
  const root = mkdtempSync(join(scratch, "t-"));
  const bin = join(root, "bin");
  exe(join(bin, "cargo"), 'echo "cargo 1.99.0 (fake 2030-01-01)"\n');
  exe(join(bin, "rustc"), 'echo "rustc 1.99.0 (fake 2030-01-01)"\n');
  exe(join(bin, "pkg-config"), "exit 0\n");
  exe(
    join(bin, "npx"),
    `for a in "$@"; do
  case "$a" in
    vite) exec "${realNpx}" "$@" ;;
    tauri) exit 0 ;;
  esac
done
exec "${realNpx}" "$@"
`,
  );
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k.startsWith("KEEL_")) continue;
    if (k === "NODE_OPTIONS" || k === "TEST" || k === "PATH") continue;
    env[k] = v;
  }
  env.PATH = [bin, dirname(process.execPath), "/usr/bin", "/bin"].join(delimiter);
  return env;
}

function keel(args: readonly string[], env: Record<string, string>): { status: number | null; records: Rec[] } {
  const r = spawnSync(process.execPath, [BIN, ...args, "--format=json"], {
    cwd: project,
    encoding: "utf8",
    env,
    timeout: testTime(240_000),
  });
  const records: Rec[] = [];
  for (const line of r.stdout.split("\n")) {
    if (line.trim() === "") continue;
    try {
      const v: unknown = JSON.parse(line);
      if (typeof v === "object" && v !== null && "kind" in v && typeof v.kind === "string")
        records.push({ ...v, kind: v.kind });
    } catch {
      // non-JSON line: ignored
    }
  }
  return { status: r.status, records };
}
const diags = (rs: Rec[]): Rec[] => rs.filter((r) => r.kind === "diag");

describe("std.tauri: the packages `keel scaffold shell tauri` writes", () => {
  test("`@tauri-apps/cli` is written into `devDependencies` at the version of `@keel/std-tauri`'s `peerDependencies`", () => {
    const peer = obj(stdPackage().peerDependencies)["@tauri-apps/cli"];
    expect(typeof peer).toBe("string");
    expect(String(peer)).toMatch(/^\d+\.\d+\.\d+$/);
    expect(obj(written(scaffolded).devDependencies)["@tauri-apps/cli"]).toBe(peer);
  });

  test("`@tauri-apps/cli` is marked optional in `peerDependenciesMeta`, and nothing is written to `dependencies` for it", () => {
    expect(obj(obj(stdPackage().peerDependenciesMeta)["@tauri-apps/cli"]).optional).toBe(true);
    expect(Object.keys(obj(written(scaffolded).dependencies)).filter((k) => k.startsWith("@tauri-apps/"))).toEqual([]);
  });

  test(
    "after the install and `keel build`, `keel check` reports no diagnostic and `keel build --target tauri` with every native tool present prints no E1572, E1574 or E1575",
    () => {
      const env = toolsEnv();
      const built = keel(["build"], env);
      expect(built.status, JSON.stringify(diags(built.records))).toBe(0);
      const check = keel(["check"], env);
      expect(diags(check.records)).toEqual([]);
      expect(check.status).toBe(0);
      const target = keel(["build", "--target", "tauri"], env);
      const codes = diags(target.records).map((r) => r.code);
      for (const code of ["E1572", "E1574", "E1575"]) expect(codes).not.toContain(code);
      expect(target.status, JSON.stringify(diags(target.records))).toBe(0);
    },
    SLOW,
  );
});
