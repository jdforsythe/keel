// The pack step of the public mode and the head-to-head Keel arm: every package built and packed into one kit folder of
// `keel-<name>-<version>.tgz` files, as a registry would serve them.
//
// Packages are unpublished and their `exports` point at `src/*.ts`, which Node cannot load from `node_modules`. The
// pack step stages each package in a scratch folder and rewrites its `package.json` there (the repository's files stay
// as they are): `./src/x.ts` becomes `./dist/src/x.js` with `types` at `./dist/src/x.d.ts`, a root `./module.ts`
// becomes `./dist/module.js` (compiled beside `dist/src` with a temporary tsconfig), `workspace:*` becomes the
// package's version, and `private`, `scripts` and `devDependencies` go. The `bin` entries already name `dist` (a
// `publishConfig.bin`, which the stage applies). `files` (`dist`, `docs`, `skills`, ...) is what the tarball carries.
import { access, copyFile, cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isRecord, sh } from "./run.ts";

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export type Packed = { name: string; version: string; file: string };

const exists = (p: string): Promise<boolean> =>
  access(p).then(
    () => true,
    () => false,
  );

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** A source target (`./src/x.ts`, `./unsafe/y.tsx`, `./module.ts`) as its built form, or `undefined` for any other file. */
export function builtPath(target: string): string | undefined {
  const m = /^\.\/(.+)\.(ts|tsx|mts)$/.exec(target);
  if (m === null || m[1] === undefined) return undefined;
  return `./dist/${m[1]}.${m[2] === "mts" ? "mjs" : "js"}`;
}

/** The declaration file of a source target. */
export function typesPath(target: string): string | undefined {
  const m = /^\.\/(.+)\.(ts|tsx|mts)$/.exec(target);
  return m === null || m[1] === undefined ? undefined : `./dist/${m[1]}.d.${m[2] === "mts" ? "mts" : "ts"}`;
}

/** `exports` with every source target pointed at its built file; `types` conditions at the declaration file. */
export function rewriteExports(node: unknown, key = ""): unknown {
  if (typeof node === "string") {
    const out = key === "types" ? typesPath(node) : builtPath(node);
    return out ?? node;
  }
  if (!isRecord(node)) return node;
  return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, rewriteExports(v, k)]));
}

/** Every `./<file>.ts` an `exports` map names outside `src/` and `unsafe/`: files the package build does not compile. */
export function rootSources(node: unknown): string[] {
  if (typeof node === "string") return /^\.\/[^/]+\.(ts|tsx|mts)$/.test(node) && !node.endsWith(".d.ts") ? [node] : [];
  if (!isRecord(node)) return [];
  return [...new Set(Object.values(node).flatMap((v) => rootSources(v)))];
}

/** The staged `package.json` of a package: published exports and bin, workspace ranges as the version, no dev fields. */
export function stagedManifest(pkg: Record<string, unknown>): Record<string, unknown> {
  const version = typeof pkg["version"] === "string" ? pkg["version"] : "0.0.0";
  const out: Record<string, unknown> = { ...pkg };
  for (const k of ["private", "scripts", "devDependencies", "publishConfig"]) Reflect.deleteProperty(out, k);
  if (pkg["exports"] !== undefined) out["exports"] = rewriteExports(pkg["exports"]);
  const pc = pkg["publishConfig"];
  if (isRecord(pc) && pc["bin"] !== undefined) out["bin"] = pc["bin"];
  for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
    const deps = pkg[field];
    if (isRecord(deps))
      out[field] = Object.fromEntries(
        Object.entries(deps).map(([k, v]) => [k, typeof v === "string" && v.startsWith("workspace:") ? version : v]),
      );
  }
  return out;
}

/** The tarball name npm gives `@keel/<name>`: `keel-<name>-<version>.tgz`. */
export const tarballName = (name: string, version: string): string =>
  `${name.replace(/^@/, "").replace("/", "-")}-${version}.tgz`;

async function readManifest(dir: string): Promise<Record<string, unknown>> {
  const j: unknown = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
  if (!isRecord(j)) throw new Error(`${dir}/package.json is not an object`);
  return j;
}

/** Packs every package's docs folder (`tooling/docs-pack.mjs --all`). */
async function packDocs(root: string): Promise<void> {
  const docs = await sh("node", [join(root, "tooling", "docs-pack.mjs"), "--all"], root);
  if (!docs.ok) throw new Error(`docs-pack failed: ${docs.output}`);
}

/** The package's own `build` script (`tsc -p tsconfig.build.json`); a package resolves its siblings through their sources, so order does not matter. */
async function buildOne(dir: string): Promise<void> {
  const built = await sh("pnpm", ["run", "build"], dir);
  if (!built.ok) throw new Error(`build failed in ${dir}: ${built.output}`);
}

async function compileRootSources(dir: string, files: readonly string[]): Promise<void> {
  const tsconfig = join(dir, "tsconfig.pack.tmp.json");
  await writeFile(tsconfig, JSON.stringify({ extends: "./tsconfig.build.json", include: ["src", "unsafe", ...files] }));
  try {
    const r = await sh("pnpm", ["exec", "tsc", "-p", tsconfig], dir);
    if (!r.ok) throw new Error(`tsc ${files.join(" ")} failed in ${dir}: ${r.output}`);
  } finally {
    await rm(tsconfig, { force: true });
  }
}

/** Stages and packs one package into `kit`. */
async function packOne(dir: string, kit: string, scratch: string, build: boolean): Promise<Packed> {
  const pkg = await readManifest(dir);
  const name = typeof pkg["name"] === "string" ? pkg["name"] : "";
  const version = typeof pkg["version"] === "string" ? pkg["version"] : "0.0.0";
  if (build) await buildOne(dir);
  const roots = rootSources(pkg["exports"]);
  if (roots.length > 0) await compileRootSources(dir, roots);
  const stage = join(scratch, name.replace("/", "-"));
  await mkdir(stage, { recursive: true });
  for (const f of strings(pkg["files"])) {
    const from = join(dir, f);
    if (await exists(from)) await cp(from, join(stage, f), { recursive: true });
  }
  for (const f of ["README.md", "LICENSE"])
    if (await exists(join(dir, f))) await copyFile(join(dir, f), join(stage, f));
  await writeFile(join(stage, "package.json"), `${JSON.stringify(stagedManifest(pkg), null, 2)}\n`);
  const packed = await sh("npm", ["pack", "--pack-destination", kit, "--silent"], stage);
  if (!packed.ok) throw new Error(`npm pack failed for ${name}: ${packed.output}`);
  return { name, version, file: join(kit, tarballName(name, version)) };
}

/**
 * Builds and packs every package under `<root>/packages` into `kit` (created, emptied of old tarballs). Returns the
 * packed names and versions, sorted by name.
 */
export async function packKit(root: string, kit: string, opts: { build?: boolean } = {}): Promise<Packed[]> {
  if (opts.build !== false) await packDocs(root);
  await mkdir(kit, { recursive: true });
  for (const f of await readdir(kit)) if (f.endsWith(".tgz")) await rm(join(kit, f));
  const scratch = await mkdtemp(join(tmpdir(), "keel-pack-"));
  try {
    const packed: Packed[] = [];
    for (const d of (await readdir(join(root, "packages"))).sort()) {
      const dir = join(root, "packages", d);
      if (await exists(join(dir, "package.json"))) packed.push(await packOne(dir, kit, scratch, opts.build !== false));
    }
    return packed.sort((a, b) => (a.name < b.name ? -1 : 1));
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

/** The kit folder of a run: `--keel-kit`, else a fresh pack into `<tmp>/keel-kit-<random>` (the caller removes it). */
export async function ensureKit(root: string, given: string | undefined): Promise<{ kit: string; made: boolean }> {
  if (given !== undefined) return { kit: resolve(given), made: false };
  const kit = await mkdtemp(join(tmpdir(), "keel-kit-"));
  await packKit(root, kit);
  return { kit, made: true };
}
