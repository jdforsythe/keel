// Packed-package exports. A package's `exports` point at `src/*.ts` so the monorepo resolves source; `publishConfig.exports`
// (and `publishConfig.bin`) point the packed tarball at the built files. Every package under packages/ is checked: the
// `private` flag is lifted at release, so a package that is private today still has to pack correctly.
// P0001 an `exports` key without a `publishConfig.exports` counterpart; P0002 a published path no build wrote (or a `*`
// pattern that matches nothing; a `keel` condition's source path too); P0003 a published path outside what `files` ships; P0004 a `bin` that points at source
// with no `publishConfig.bin`, or a published bin that is missing or outside `files`.
// Usage: node tooling/publish-exports.mjs --check (after `pnpm build`) | --fix (derive the missing entries from `exports`).
import fs from "node:fs";
import path from "node:path";
import { parseArgs, run } from "./output.ts";

const defaultRoot = path.join(import.meta.dirname, "..");
const ALWAYS = new Set(["package.json"]);
const isDeclarationFile = (p) => p.endsWith(".d.ts") || p.endsWith(".d.mts") || p.endsWith(".d.cts");
const isSource = (p) => /\.(ts|mts|cts)$/.test(p) && !isDeclarationFile(p);

/**
 * Where the build writes a source path: `./src/a.ts` to `./dist/src/a.js` (or `.d.ts` for a `types` condition). A
 * `keel` condition keeps its source path: a library ships its source for the app's compiler (k.library-pack Package).
 */
export function builtPath(p, condition) {
  if (!isSource(p) || condition === "keel") return p;
  const stem = p.replace(/\.(ts|mts|cts)$/, "");
  return `./dist/${stem.slice(2)}${condition === "types" ? ".d.ts" : ".js"}`;
}

/** `exports` value mapped to built files; a string under no condition counts as `default`. */
export function mapTarget(value, condition = "default") {
  if (typeof value === "string") return builtPath(value, condition);
  if (Array.isArray(value)) return value.map((v) => mapTarget(v, condition));
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapTarget(v, k === "types" ? "types" : k)]));
  return value;
}

/** The `publishConfig.exports` a package's `exports` imply. */
export const deriveExports = (exports) =>
  Object.fromEntries(Object.entries(exports).map(([key, value]) => [key, mapTarget(value)]));

/** Every string path a conditions object holds. */
function pathsOf(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(pathsOf);
  if (value && typeof value === "object") return Object.values(value).flatMap(pathsOf);
  return [];
}

const norm = (p) => p.replace(/^\.\//, "").replace(/\/+$/, "");

/** Whether a package-relative path is inside an entry of `files` (or always packed). */
export function shipped(rel, files) {
  const r = norm(rel);
  if (ALWAYS.has(r)) return true;
  return files.some((f) => {
    const e = norm(f);
    return r === e || r.startsWith(`${e}/`);
  });
}

/** The files a published path names: itself, or those a `*` pattern matches. */
function matches(dir, rel) {
  const r = norm(rel);
  if (!r.includes("*")) return fs.existsSync(path.join(dir, r)) ? [r] : [];
  const [head, tail] = r.split("*");
  const cut = head.lastIndexOf("/") + 1;
  const folder = head.slice(0, cut);
  const prefix = head.slice(cut);
  const out = [];
  const walk = (relDir) => {
    const abs = path.join(dir, relDir);
    if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const name = `${relDir}${e.name}`;
      if (e.isDirectory()) walk(`${name}/`);
      else if (name.slice(folder.length).startsWith(prefix) && name.endsWith(tail)) out.push(name);
    }
  };
  walk(folder);
  return out;
}

/** The packages under `root/packages`: directory, parsed manifest and manifest path. */
export function readPackages(root) {
  const dir = path.join(root, "packages");
  return fs
    .readdirSync(dir)
    .filter((d) => fs.existsSync(path.join(dir, d, "package.json")))
    .sort()
    .map((d) => {
      const file = path.join(dir, d, "package.json");
      return { dir: path.join(dir, d), file, manifest: JSON.parse(fs.readFileSync(file, "utf8")) };
    });
}

/** Diagnostics for one package; `root` makes paths relative in the output. */
export function checkPackage({ dir, manifest }, root) {
  const diags = [];
  const where = path.relative(root, path.join(dir, "package.json"));
  const at = (code, message, fix) => diags.push({ kind: "diag", code, path: where, message, ...(fix ? { fix } : {}) });
  const files = manifest.files ?? [];
  const published = manifest.publishConfig?.exports ?? {};
  const verify = (rel, label) => {
    if (!shipped(rel, files)) at("P0003", `${label} ${rel} is outside \`files\` (${files.join(", ")})`);
    else if (matches(dir, rel).length === 0)
      at("P0002", `${label} ${rel} does not exist after the build`, "run `pnpm build`");
  };
  for (const key of Object.keys(manifest.exports ?? {})) {
    if (!(key in published)) {
      at(
        "P0001",
        `exports "${key}" has no publishConfig.exports counterpart`,
        "node tooling/publish-exports.mjs --fix",
      );
      continue;
    }
    for (const rel of pathsOf(published[key])) verify(rel, `publishConfig.exports "${key}"`);
  }
  for (const key of Object.keys(published))
    if (!(key in (manifest.exports ?? {}))) at("P0001", `publishConfig.exports "${key}" has no exports entry`);
  const bins = typeof manifest.bin === "string" ? { bin: manifest.bin } : (manifest.bin ?? {});
  const pubBin = manifest.publishConfig?.bin;
  const pubBins = typeof pubBin === "string" ? { bin: pubBin } : pubBin;
  for (const [name, rel] of Object.entries(bins)) {
    const target = pubBins?.[name] ?? rel;
    if (!pubBins?.[name] && !shipped(rel, files))
      at("P0004", `bin "${name}" points at ${rel}, outside \`files\`, with no publishConfig.bin`);
    else verify(target, `bin "${name}"`);
  }
  return diags;
}

/** Add the derived entries a package lacks (existing entries stay); returns whether the manifest changed. */
export function fixPackage(pkg) {
  const { manifest } = pkg;
  if (!manifest.exports) return false;
  const derived = deriveExports(manifest.exports);
  const current = manifest.publishConfig?.exports ?? {};
  const merged = { ...derived, ...current };
  if (Object.keys(merged).length === Object.keys(current).length) return false;
  manifest.publishConfig = { ...(manifest.publishConfig ?? {}), exports: merged };
  const out = {};
  for (const [k, v] of Object.entries(manifest)) if (k !== "publishConfig") out[k] = v;
  const rebuilt = {};
  let placed = false;
  for (const [k, v] of Object.entries(out)) {
    rebuilt[k] = v;
    if (k === "bin" || (k === "exports" && !("bin" in out))) {
      rebuilt.publishConfig = manifest.publishConfig;
      placed = true;
    }
  }
  if (!placed) rebuilt.publishConfig = manifest.publishConfig;
  fs.writeFileSync(pkg.file, `${JSON.stringify(rebuilt, null, 2)}\n`);
  return true;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const args = parseArgs();
  const root = args.values.get("root") ?? defaultRoot;
  await run("publish-exports", () => {
    const packages = readPackages(root);
    if (args.flags.has("fix")) {
      const changed = packages.filter(fixPackage).map((p) => p.manifest.name);
      return {
        diags: [],
        counts: { changed: changed.length },
        line: `ok publish-exports fixed ${changed.length} packages`,
      };
    }
    const diags = packages.flatMap((p) => checkPackage(p, root));
    return { diags, counts: { packages: packages.length }, line: `ok publish-exports ${packages.length} packages` };
  });
}
