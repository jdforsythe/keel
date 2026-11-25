// k.scaffold: a project `keel scaffold project` writes builds with `keel build` on its first run, with exactly the
// dependencies its `package.json` lists. The project is installed the way packed tarballs would be, in pnpm's isolated
// layout outside the repository: each `@keel/*` package is a copy of what it ships (`files`, its `package.json` with the
// `publishConfig` exports and bin), and its `node_modules` holds only what its manifest declares (dependencies, peers
// that are not optional, optional peers the project lists). A package that imports what it does not declare fails here
// as it would for a public user; inside the monorepo its own dev dependencies would hide it.
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

/**
 * Installs the project at `cwd` from its `package.json`: `@keel/*` as packed copies under `cwd/.store`, each linked to
 * what it declares; third-party packages linked to the repo's installed copies, which carry their own dependencies.
 */
function install(cwd: string): void {
  const project = manifest(cwd);
  const wanted = [...project.dependencies, ...keys(project.json.devDependencies)];
  const staged = new Map<string, string>();
  const stage = (name: string): string => {
    const done = staged.get(name);
    if (done !== undefined) return done;
    const m = manifest(join(REPO, "packages", name.replace(/^@keel\//, "")));
    const at = join(cwd, ".store", name.replace("/", "+"), "node_modules", name);
    staged.set(name, at);
    mkdirSync(at, { recursive: true });
    for (const f of m.files) if (existsSync(join(m.dir, f))) cpSync(join(m.dir, f), join(at, f), { recursive: true });
    writeFileSync(join(at, "package.json"), packedManifest(m));
    const own = [...m.dependencies, ...m.peers, ...m.optionalPeers.filter((n) => wanted.includes(n))];
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
  if (!existsSync(join(bin, keel))) throw new Error(`the packed @keel/cli has no bin at ${keel}: run pnpm build`);
}

it("a scaffolded project builds with keel build from exactly its listed dependencies", async () => {
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
    install(cwd);
    const keel = join(cwd, "node_modules/@keel/cli/dist/src/bin.js");
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env))
      if (v !== undefined && !k.toLowerCase().startsWith("npm_") && k !== "NODE_OPTIONS" && k !== "KEEL_AGENT")
        env[k] = v;
    const r = spawnSync(process.execPath, [keel, "build"], { cwd, env, encoding: "utf8" });
    const out = `${r.stdout}${r.stderr}`;
    expect(r.status, out).toBe(0);
    expect(out.trim().split("\n").at(-1), out).toMatch(/^ok build /);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}, 120_000);
