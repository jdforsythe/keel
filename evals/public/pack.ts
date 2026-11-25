// The pack step of the public mode and the head-to-head Keel arm: every package built and packed into one kit folder of
// `keel-<name>-<version>.tgz` files, as a registry would serve them.
//
// Packages are unpublished and their `exports` point at `src/*.ts`, which Node cannot load from `node_modules`. The
// pack step stages each package in a scratch folder and rewrites its `package.json` there (the repository's files stay
// as they are). A package's `publishConfig.exports` (kept by `tooling/publish-exports.mjs`; a `null` target is a
// subpath the tarball does not export) is the staged `exports`, as a registry publish applies it; a package without
// one has its `exports` rewritten: `./src/x.ts` becomes `./dist/src/x.js` with `types` at `./dist/src/x.d.ts`, a root `./module.ts`
// becomes `./dist/module.js` (compiled beside `dist/src` with a temporary tsconfig), a declaration file
// (`./src/client.d.ts`) stays where it is, `workspace:*` becomes the package's version, and `private`, `scripts` and
// `devDependencies` go. The `bin` entries already name `dist` (a `publishConfig.bin`, which the stage applies). `files`
// (`dist`, `docs`, `skills`, ...) is what the tarball carries.
//
// After `npm pack`, every `exports` target (each condition, `types` included, and each `*` pattern) and every `bin`
// target is looked up in the tarball's file list. A target the tarball lacks fails the pack: P0003 when the package
// folder has the file (`files` leaves it out), P0002 when it does not (no build wrote it); the codes are
// `tooling/publish-exports.mjs`'s.
import { execFile } from "node:child_process";
import { access, copyFile, cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Diag } from "../../tooling/output.ts";
import { emit } from "../../tooling/output.ts";
import { isRecord, sh } from "./run.ts";

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export type Packed = { name: string; version: string; file: string };

const exists = (p: string): Promise<boolean> =>
  access(p).then(
    () => true,
    () => false,
  );

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Whether a target is a declaration file (`.d.ts`, `.d.mts`, `.d.cts`): shipped as written, never compiled. */
export const isDeclaration = (target: string): boolean => /\.d\.(ts|mts|cts)$/.test(target);

/** The stem and extension of a source target, or `undefined` for a declaration file or any other file. */
function source(target: string): { stem: string; ext: string } | undefined {
  if (isDeclaration(target)) return undefined;
  const m = /^\.\/(.+)\.(ts|tsx|mts)$/.exec(target);
  return m === null || m[1] === undefined || m[2] === undefined ? undefined : { stem: m[1], ext: m[2] };
}

/** A source target (`./src/x.ts`, `./unsafe/y.tsx`, `./module.ts`) as its built form, or `undefined` for any other file. */
export function builtPath(target: string): string | undefined {
  const s = source(target);
  return s === undefined ? undefined : `./dist/${s.stem}.${s.ext === "mts" ? "mjs" : "js"}`;
}

/** The declaration file of a source target, or `undefined` for any other file (a declaration file included). */
export function typesPath(target: string): string | undefined {
  const s = source(target);
  return s === undefined ? undefined : `./dist/${s.stem}.d.${s.ext === "mts" ? "mts" : "ts"}`;
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
  if (typeof node === "string") return /^\.\/[^/]+\.(ts|tsx|mts)$/.test(node) && !isDeclaration(node) ? [node] : [];
  if (!isRecord(node)) return [];
  return [...new Set(Object.values(node).flatMap((v) => rootSources(v)))];
}

/**
 * The staged `package.json` of a package: `publishConfig` exports (else the rewritten `exports`) and bin, workspace
 * ranges as the version, no dev fields.
 */
export function stagedManifest(pkg: Record<string, unknown>): Record<string, unknown> {
  const version = typeof pkg["version"] === "string" ? pkg["version"] : "0.0.0";
  const out: Record<string, unknown> = { ...pkg };
  for (const k of ["private", "scripts", "devDependencies", "publishConfig"]) Reflect.deleteProperty(out, k);
  const pc = pkg["publishConfig"];
  if (isRecord(pc) && pc["exports"] !== undefined) out["exports"] = pc["exports"];
  else if (pkg["exports"] !== undefined) out["exports"] = rewriteExports(pkg["exports"]);
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

/** Every target string an `exports` value or `bin` holds, through conditions and fallback arrays. */
export function targets(node: unknown): string[] {
  if (typeof node === "string") return [node];
  if (Array.isArray(node)) return node.flatMap((v) => targets(v));
  if (!isRecord(node)) return [];
  return Object.values(node).flatMap((v) => targets(v));
}

/** Whether a package-relative target (`./dist/x.js`, `./dist/std/*.js`) names a file of `files` (paths without `./`). */
export function inTarball(target: string, files: ReadonlySet<string>): boolean {
  const t = target.replace(/^\.\//, "");
  const star = t.indexOf("*");
  if (star < 0) return files.has(t);
  const head = t.slice(0, star);
  const tail = t.slice(star + 1);
  return [...files].some((f) => f.length >= head.length + tail.length && f.startsWith(head) && f.endsWith(tail));
}

/**
 * The pack-time lint of one staged manifest against its tarball's file list: a diagnostic for each `exports` and
 * `bin` target the tarball lacks. `onDisk` says whether the package folder has the file (P0003) or not (P0002).
 */
export function tarballFindings(
  where: string,
  manifest: Record<string, unknown>,
  files: ReadonlySet<string>,
  onDisk: (target: string) => boolean,
): Diag[] {
  const out: Diag[] = [];
  const look = (label: string, node: unknown): void => {
    for (const t of [...new Set(targets(node))])
      if (!inTarball(t, files))
        out.push(
          onDisk(t)
            ? {
                kind: "diag",
                code: "P0003",
                path: where,
                message: `${label} ${t} is outside \`files\`, not in the tarball`,
              }
            : {
                kind: "diag",
                code: "P0002",
                path: where,
                message: `${label} ${t} is not in the tarball; no build wrote it`,
              },
        );
  };
  const exp = manifest["exports"];
  if (isRecord(exp) && Object.keys(exp).some((k) => k.startsWith(".")))
    for (const [k, v] of Object.entries(exp)) look(`exports "${k}"`, v);
  else if (exp !== undefined) look("exports", exp);
  const bin = manifest["bin"];
  if (typeof bin === "string") look("bin", bin);
  else if (isRecord(bin)) for (const [k, v] of Object.entries(bin)) look(`bin "${k}"`, v);
  return out;
}

/** The pack-time lint failed: `diags` holds a finding per missing target, `message` their compact form. */
export class PackFindings extends Error {
  readonly diags: Diag[];
  constructor(diags: Diag[]) {
    super(emit(diags));
    this.name = "PackFindings";
    this.diags = diags;
  }
}

/** The files a tarball holds, package-relative (`dist/src/index.js`). */
function tarballFiles(file: string): Promise<Set<string>> {
  return new Promise((done, fail) => {
    execFile("tar", ["-tzf", file], { maxBuffer: 64 * 1024 * 1024 }, (err, stdout) => {
      if (err !== null) fail(new Error(`tar -tzf ${file} failed: ${err.message}`));
      else
        done(
          new Set(
            stdout
              .split("\n")
              .filter((l) => l !== "" && !l.endsWith("/"))
              .map((l) => l.replace(/^package\//, "")),
          ),
        );
    });
  });
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
async function packOne(
  dir: string,
  kit: string,
  scratch: string,
  build: boolean,
  root: string,
): Promise<{ packed: Packed; diags: Diag[] }> {
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
  const staged = stagedManifest(pkg);
  await writeFile(join(stage, "package.json"), `${JSON.stringify(staged, null, 2)}\n`);
  const packed = await sh("npm", ["pack", "--pack-destination", kit, "--silent"], stage);
  if (!packed.ok) throw new Error(`npm pack failed for ${name}: ${packed.output}`);
  const file = join(kit, tarballName(name, version));
  const where = relative(root, join(dir, "package.json"));
  const onDisk = new Map<string, boolean>();
  for (const t of targets([staged["exports"], staged["bin"]]))
    if (!t.includes("*")) onDisk.set(t, await exists(join(dir, t)));
  const diags = tarballFindings(where, staged, await tarballFiles(file), (t) => onDisk.get(t) === true);
  return { packed: { name, version, file }, diags };
}

/**
 * Builds and packs every package under `<root>/packages` into `kit` (created, emptied of old tarballs). Returns the
 * packed names and versions, sorted by name; throws `PackFindings` when a tarball lacks a target its manifest names.
 */
export async function packKit(root: string, kit: string, opts: { build?: boolean } = {}): Promise<Packed[]> {
  if (opts.build !== false) await packDocs(root);
  await mkdir(kit, { recursive: true });
  for (const f of await readdir(kit)) if (f.endsWith(".tgz")) await rm(join(kit, f));
  const scratch = await mkdtemp(join(tmpdir(), "keel-pack-"));
  try {
    const packed: Packed[] = [];
    const diags: Diag[] = [];
    for (const d of (await readdir(join(root, "packages"))).sort()) {
      const dir = join(root, "packages", d);
      if (!(await exists(join(dir, "package.json")))) continue;
      const one = await packOne(dir, kit, scratch, opts.build !== false, root);
      packed.push(one.packed);
      diags.push(...one.diags);
    }
    if (diags.length > 0) throw new PackFindings(diags);
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
