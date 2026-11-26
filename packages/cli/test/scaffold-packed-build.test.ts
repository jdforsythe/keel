// k.scaffold: a project `keel scaffold project` writes builds with `keel build` on its first run, with exactly the
// dependencies its `package.json` lists. The project is installed the way packed tarballs would be, in pnpm's isolated
// layout outside the repository: each `@keel/*` package is a copy of what it ships (`files`, its `package.json` with the
// `publishConfig` exports and bin), and its `node_modules` holds only what its manifest declares (dependencies, peers
// that are not optional, optional peers the project lists). A package that imports what it does not declare fails here
// as it would for a public user; inside the monorepo its own dev dependencies would hide it. The test builds and packs
// what it installs itself, so it needs no earlier `pnpm build`.
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { repoRoot } from "@keel/tooling/repo-root";
import { fixedTime } from "@keel/tooling/test-time";
import { expect, it } from "vitest";
import { runEngine } from "../src/internal/runEngine.ts";

const REPO = repoRoot(import.meta.dirname);

type Manifest = {
  readonly dir: string;
  readonly name: string;
  readonly files: readonly string[];
  readonly dependencies: readonly string[];
  readonly peers: readonly string[];
  readonly optionalPeers: readonly string[];
  readonly json: Record<string, unknown>;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const keys = (v: unknown): string[] => (isRecord(v) ? Object.keys(v) : []);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s) => typeof s === "string") : []);

function manifest(dir: string): Manifest {
  const json: unknown = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  if (!isRecord(json)) throw new Error(`${dir}/package.json is not an object`);
  const meta = isRecord(json.peerDependenciesMeta) ? json.peerDependenciesMeta : {};
  const optional = (n: string): boolean => {
    const m = meta[n];
    return isRecord(m) && m.optional === true;
  };
  const peers = keys(json.peerDependencies);
  return {
    dir,
    name: typeof json.name === "string" ? json.name : "",
    files: strings(json.files),
    dependencies: keys(json.dependencies),
    peers: peers.filter((n) => !optional(n)),
    optionalPeers: peers.filter(optional),
    json,
  };
}

/** The `package.json` a packed tarball carries: the `publishConfig` exports and bin, no dev fields. */
function packedManifest(m: Manifest): string {
  const out: Record<string, unknown> = { ...m.json };
  const pc = isRecord(m.json.publishConfig) ? m.json.publishConfig : {};
  for (const k of ["private", "scripts", "devDependencies", "publishConfig"]) Reflect.deleteProperty(out, k);
  if (pc.exports !== undefined) out.exports = pc.exports;
  if (pc.bin !== undefined) out.bin = pc.bin;
  return `${JSON.stringify(out, null, 2)}\n`;
}

/** The real folder of a third-party package `name` as the repo's install resolved it for the package at `from`. */
function thirdParty(name: string, from: string): string {
  const at = [
    join(from, "node_modules", name),
    join(REPO, "packages/cli/node_modules", name),
    join(REPO, "node_modules", name),
  ].find((p) => existsSync(join(p, "package.json")));
  if (at === undefined) throw new Error(`${name} is not installed in the repo (wanted by ${from})`);
  return realpathSync(at);
}

const link = (target: string, at: string): void => {
  if (existsSync(at)) return;
  mkdirSync(dirname(at), { recursive: true });
  symlinkSync(target, at, "dir");
};

/** What the project at `cwd` lists, dependencies and dev dependencies. */
function listed(cwd: string): string[] {
  const project = manifest(cwd);
  return [...project.dependencies, ...keys(project.json.devDependencies)];
}

const keelPackage = (name: string): Manifest => manifest(join(REPO, "packages", name.replace(/^@keel\//, "")));

/** What an installed `m` links in its `node_modules`, for a project that lists `wanted`. */
const declared = (m: Manifest, wanted: readonly string[]): string[] => [
  ...m.dependencies,
  ...m.peers,
  ...m.optionalPeers.filter((n) => wanted.includes(n)),
];

/** Every `@keel/*` package `install` stages for a project that lists `wanted`, by name. */
function packed(wanted: readonly string[]): Manifest[] {
  const out = new Map<string, Manifest>();
  const visit = (name: string): void => {
    if (!name.startsWith("@keel/") || out.has(name)) return;
    const m = keelPackage(name);
    out.set(name, m);
    for (const dep of declared(m, wanted)) visit(dep);
  };
  for (const name of wanted) visit(name);
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** The environment a child of this test runs with: no npm or vitest process options, no agent output mode. */
function childEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env))
    if (v !== undefined && !k.toLowerCase().startsWith("npm_") && k !== "NODE_OPTIONS" && k !== "KEEL_AGENT")
      env[k] = v;
  return env;
}

const tail = (r: { stdout: string; stderr: string }): string =>
  `${r.stdout}${r.stderr}`.trim().split("\n").slice(-20).join("\n");

/**
 * Gives each package in `ms` what its tarball ships, as `pnpm pack` would: its build through turbo (cached, and with
 * the builds it depends on), then its `prepack` where a `files` entry is still absent. Throws, naming the package and
 * the entry, when a `files` entry or a `publishConfig.bin` is absent after that, so the install never copies a package
 * that ships nothing. Whether every `publishConfig.exports` path exists is `tooling/publish-exports.mjs --check`'s.
 */
function ship(ms: readonly Manifest[]): void {
  const env = { ...childEnv(), TURBO_NO_UPDATE_NOTIFIER: "1", NO_COLOR: "1" };
  const pnpm = (args: string[], cwd: string) =>
    spawnSync("pnpm", args, { cwd, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const filters = ms.map((m) => `--filter=${m.name}`);
  const built = pnpm(["exec", "turbo", "run", "build", ...filters, "--output-logs=errors-only", "--ui=stream"], REPO);
  if (built.status !== 0) throw new Error(`turbo build of ${ms.map((m) => m.name).join(", ")} failed:\n${tail(built)}`);
  const absent = (m: Manifest): string[] => m.files.filter((f) => !existsSync(join(m.dir, f)));
  for (const m of ms) {
    const scripts = isRecord(m.json.scripts) ? m.json.scripts : {};
    if (absent(m).length === 0 || typeof scripts.prepack !== "string") continue;
    const r = pnpm(["run", "--silent", "prepack"], m.dir);
    if (r.status !== 0) throw new Error(`${m.name} prepack failed:\n${tail(r)}`);
  }
  const missing: string[] = [];
  for (const m of ms) {
    for (const f of absent(m)) missing.push(`${m.name} files entry ${f}`);
    const pc = isRecord(m.json.publishConfig) ? m.json.publishConfig : {};
    for (const [what, rel] of bins(pc)) if (!existsSync(join(m.dir, rel))) missing.push(`${m.name} ${what} ${rel}`);
  }
  if (missing.length > 0) throw new Error(`packed packages lack what they ship: ${missing.join("; ")}`);
}

/** Each path `publishConfig.bin` points at, with where it is named. */
function bins(pc: Record<string, unknown>): [string, string][] {
  if (typeof pc.bin === "string") return [["publishConfig.bin", pc.bin]];
  if (!isRecord(pc.bin)) return [];
  const out: [string, string][] = [];
  for (const [k, v] of Object.entries(pc.bin)) if (typeof v === "string") out.push([`publishConfig.bin ${k}`, v]);
  return out;
}

/**
 * Installs the project at `cwd` from its `package.json`: `@keel/*` as packed copies under `cwd/.store`, each linked to
 * what it declares; third-party packages linked to the repo's installed copies, which carry their own dependencies.
 */
function install(cwd: string): string {
  const wanted = listed(cwd);
  const staged = new Map<string, string>();
  const stage = (name: string): string => {
    const done = staged.get(name);
    if (done !== undefined) return done;
    const m = keelPackage(name);
    const at = join(cwd, ".store", name.replace("/", "+"), "node_modules", name);
    staged.set(name, at);
    mkdirSync(at, { recursive: true });
    for (const f of m.files) cpSync(join(m.dir, f), join(at, f), { recursive: true });
    writeFileSync(join(at, "package.json"), packedManifest(m));
    const own = declared(m, wanted);
    for (const dep of own) {
      const target = dep.startsWith("@keel/") ? stage(dep) : thirdParty(dep, m.dir);
      link(target, join(cwd, ".store", name.replace("/", "+"), "node_modules", dep));
    }
    return at;
  };
  for (const name of wanted) {
    link(name.startsWith("@keel/") ? stage(name) : thirdParty(name, REPO), join(cwd, "node_modules", name));
  }
  const bin = join(cwd, "node_modules/@keel/cli");
  const cli = manifest(bin).json.bin;
  const keel = isRecord(cli) && typeof cli.keel === "string" ? cli.keel : "";
  if (!existsSync(join(bin, keel))) throw new Error(`the packed @keel/cli has no bin at ${keel}`);
  return join(bin, keel);
}

// The time limit covers the packed packages' builds: minutes on a checkout with none, a second from turbo's cache.
it(
  "a scaffolded project builds with keel build from exactly its listed dependencies",
  async () => {
    const e = await runEngine(["scaffold", "project", "shop"], { cwd: "/work", files: [] });
    expect(e.result.code).toBe(0);
    const cwd = realpathSync(mkdtempSync(join(tmpdir(), "keel-packed-build-")));
    try {
      for (const w of e.writes) {
        if (w.content === null) continue;
        const path = join(cwd, w.path.replace(/^\/work\/shop\//, "").replace(/^shop\//, ""));
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, w.content);
      }
      ship(packed(listed(cwd)));
      const keel = install(cwd);
      const r = spawnSync(process.execPath, [keel, "build"], { cwd, env: childEnv(), encoding: "utf8" });
      const out = `${r.stdout}${r.stderr}`;
      expect(r.status, out).toBe(0);
      expect(out.trim().split("\n").at(-1), out).toMatch(/^ok build /);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  fixedTime(600_000),
);
