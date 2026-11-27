import fs from "node:fs";
import path from "node:path";
import type { Metafile } from "esbuild";
import { isNodeBuiltin } from "./isNodeBuiltin.ts";
import { jsonc } from "./jsonc.ts";

/** The file extensions and index files a specifier without one may name, as the bundle resolves them. */
const EXTS = [".tsx", ".ts", ".jsx", ".js", ".mts", ".cts", ".mjs", ".cjs", ".css", ".json"];
/** A `.js`-family specifier may name the TypeScript file beside it. */
const TS_OF: Readonly<Record<string, readonly string[]>> = {
  ".js": [".ts", ".tsx"],
  ".jsx": [".tsx"],
  ".mjs": [".mts"],
  ".cjs": [".cts"],
};
/** The configuration files the bundle's resolver reads nearest each file, in the order it looks for them. */
const CONFIGS: readonly (readonly string[])[] = [["package.json"], ["tsconfig.json", "jsconfig.json"]];

type Probe = readonly ["realpath" | "stat", string];

const isRecord = (x: unknown): x is Readonly<Record<string, unknown>> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

/** The package a bare specifier names and the rest of it: `@scope/name` or `name`; undefined for any other. */
function bare(spec: string): { name: string; sub: string } | undefined {
  if (spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(spec))
    return undefined;
  const parts = spec.split("/");
  const n = spec.startsWith("@") ? 2 : 1;
  if (parts.length < n || parts.slice(0, n).some((p) => p === "")) return undefined;
  return { name: parts.slice(0, n).join("/"), sub: parts.slice(n).join("/") };
}

/** Every string leaf of an `exports` value (any condition), with each `*` replaced by `star`. */
function leaves(v: unknown, star: string): string[] {
  if (typeof v === "string") return [v.replaceAll("*", star)];
  if (Array.isArray(v)) return v.flatMap((x) => leaves(x, star));
  return isRecord(v) ? Object.values(v).flatMap((x) => leaves(x, star)) : [];
}

/** The targets `sub` (`""` for the package itself) may name in a package's `package.json`, relative to its folder. */
function targets(pkg: unknown, sub: string): string[] {
  const key = sub === "" ? "." : `./${sub}`;
  const out: string[] = [];
  const exp = isRecord(pkg) ? pkg.exports : undefined;
  if (typeof exp === "string" || Array.isArray(exp)) {
    if (key === ".") out.push(...leaves(exp, ""));
  } else if (isRecord(exp)) {
    const keyed = Object.keys(exp).some((k) => k.startsWith("."));
    if (!keyed && key === ".") out.push(...leaves(exp, ""));
    for (const [k, v] of Object.entries(exp)) {
      if (k === key) out.push(...leaves(v, ""));
      const at = k.indexOf("*");
      if (at >= 0 && key.startsWith(k.slice(0, at)) && key.endsWith(k.slice(at + 1)))
        out.push(...leaves(v, key.slice(at, key.length - (k.length - at - 1))));
    }
  }
  if (sub === "" && isRecord(pkg))
    for (const f of ["main", "module"]) if (typeof pkg[f] === "string") out.push(String(pkg[f]));
  if (sub !== "") out.push(sub);
  return out;
}

/** The files a path may name: itself, with each extension, its TypeScript twin, and an index file in it. */
function candidates(base: string): string[] {
  const ext = path.extname(base);
  const twins = (TS_OF[ext] ?? []).map((e) => base.slice(0, -ext.length) + e);
  return [base, ...EXTS.map((e) => base + e), ...twins, ...EXTS.map((e) => path.join(base, `index${e}`))];
}

/**
 * What the bundle's resolver asked of the file system for a build-time evaluation (k.derived Derivation cache), as
 * probes and input files. For each import in `metafile`, from the importer's folder: a relative specifier's
 * candidates (`candidates`: itself, each extension, the TypeScript twin, each index file) up to the one whose real
 * path the bundle loaded, each before it a `stat` probe (absent when it ran); a bare one's `<folder>/node_modules/<name>`
 * walking up, each a `realpath` probe up to the first present, then its candidates through the package's `exports`,
 * `main` or subpath the same way; with a `tsconfig.json` `baseUrl` or `paths`, every candidate of each target a bare
 * specifier maps to, a `stat` probe; an import that resolved to nothing (left to run time), every candidate and every
 * level of the walk. Each symbolic link below the folder a lookup starts from on the path to the file loaded is a
 * `realpath` probe, so a link pointed elsewhere is seen. For each folder holding a loaded file, walking up, the
 * nearest `package.json` and the nearest `tsconfig.json` or `jsconfig.json` (with each file its `extends` names) are
 * `files`, and each one absent before them a `stat` probe. `reads` add each link on each path the code read by.
 */
export function pathLinks(
  root: string,
  metafile: Metafile,
  reads: readonly string[] = [],
): { probes: Probe[]; files: string[] } {
  const out = new Map<string, Probe>();
  const files = new Set<string>();
  const add = (kind: Probe[0], p: string): void => {
    if (!out.has(`${kind}\0${p}`)) out.set(`${kind}\0${p}`, [kind, p]);
  };
  const isLink = new Map<string, boolean>();
  const real = new Map<string, string | undefined>();
  const linkAt = (p: string): boolean => {
    let v = isLink.get(p);
    if (v === undefined) {
      try {
        v = fs.lstatSync(p).isSymbolicLink();
      } catch {
        v = false;
      }
      isLink.set(p, v);
    }
    return v;
  };
  const realOf = (p: string): string | undefined => {
    if (real.has(p)) return real.get(p);
    let v: string | undefined;
    try {
      v = fs.realpathSync(p);
    } catch {
      v = undefined;
    }
    real.set(p, v);
    return v;
  };
  const isFile = (p: string): boolean => {
    try {
      return fs.statSync(p).isFile();
    } catch {
      return false;
    }
  };
  /** Each link on `p` below the folder `from`. */
  const below = (from: string, p: string): void => {
    for (let d = p; d.length > from.length && d.startsWith(from); d = path.dirname(d))
      if (linkAt(d)) add("realpath", d);
  };
  /** The candidate of `list` the bundle loaded (`loaded`), each before it a `stat` probe; every one when none is. */
  const upTo = (list: readonly string[], loaded: string | undefined): string | undefined => {
    for (const c of list) {
      if (loaded !== undefined && realOf(c) === loaded) return c;
      add("stat", c);
    }
    return undefined;
  };
  const packageJson = new Map<string, unknown>();
  const pkgOf = (dir: string): unknown => {
    if (!packageJson.has(dir)) {
      let v: unknown;
      try {
        v = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
      } catch {
        v = undefined;
      }
      packageJson.set(dir, v);
    }
    return packageJson.get(dir);
  };
  /** A bare specifier's walk from `from`: each `node_modules/<name>` probed up to the first present, and its file. */
  const walk = (from: string, named: { name: string; sub: string }, loaded: string | undefined): void => {
    for (let d = from; ; d = path.dirname(d)) {
      if (path.basename(d) !== "node_modules") {
        const at = path.join(d, "node_modules", named.name);
        const dir = realOf(at);
        add("realpath", at);
        if (dir !== undefined || linkAt(at)) {
          below(d, at);
          const tried = targets(pkgOf(at), named.sub).flatMap((t) => candidates(path.join(at, t)));
          const inside =
            dir !== undefined && loaded !== undefined && loaded.startsWith(`${dir}${path.sep}`)
              ? loaded.slice(dir.length)
              : "";
          const c = upTo([...tried, ...(inside === "" ? [] : [at + inside])], loaded);
          if (c !== undefined) below(at, c);
          if (loaded !== undefined) return;
        }
      }
      if (path.dirname(d) === d) return;
    }
  };
  // The nearest of each configuration file per folder, walking up; each absent one before it is a `stat` probe.
  const nearest = new Map<string, string | undefined>();
  const configAt = (dir: string, names: readonly string[]): string | undefined => {
    const memo = `${names[0] ?? ""}\0${dir}`;
    if (nearest.has(memo)) return nearest.get(memo);
    let found: string | undefined;
    for (const n of names) {
      const f = path.join(dir, n);
      if (isFile(f)) {
        found = f;
        break;
      }
      add("stat", f);
    }
    if (found === undefined && path.dirname(dir) !== dir) found = configAt(path.dirname(dir), names);
    nearest.set(memo, found);
    return found;
  };
  /** A `tsconfig.json` and each file its `extends` names, as files; its `baseUrl` and `paths`, the nearest set. */
  type Aliases = { base: string; paths: Readonly<Record<string, unknown>> | undefined };
  const aliases = new Map<string, Aliases | undefined>();
  const tsconfig = (file: string, depth = 0): Aliases | undefined => {
    if (aliases.has(file)) return aliases.get(file);
    aliases.set(file, undefined);
    files.add(file);
    let text = "";
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      return undefined;
    }
    const v = jsonc(text);
    const dir = path.dirname(file);
    let inherited: Aliases | undefined;
    const ext = isRecord(v) ? v.extends : undefined;
    for (const e of typeof ext === "string" ? [ext] : Array.isArray(ext) ? ext : []) {
      if (typeof e !== "string" || depth > 8) continue;
      const named = bare(e);
      let target: string | undefined;
      if (named === undefined) {
        const p = path.resolve(dir, e);
        add("stat", p);
        target = isFile(p) ? p : `${p}.json`;
        add("stat", target);
      } else {
        walk(dir, named, undefined);
        for (let d = dir; ; d = path.dirname(d)) {
          const at = path.join(d, "node_modules", named.name);
          if (realOf(at) !== undefined) {
            target = targets(pkgOf(at), named.sub)
              .flatMap((t) => candidates(path.join(at, t)))
              .find(isFile);
            break;
          }
          if (path.dirname(d) === d) break;
        }
      }
      if (target !== undefined && isFile(target)) inherited = tsconfig(target, depth + 1) ?? inherited;
    }
    const options = isRecord(v) && isRecord(v.compilerOptions) ? v.compilerOptions : {};
    const own: Aliases | undefined =
      typeof options.baseUrl === "string" || isRecord(options.paths)
        ? {
            base: typeof options.baseUrl === "string" ? path.resolve(dir, options.baseUrl) : dir,
            paths: isRecord(options.paths) ? options.paths : inherited?.paths,
          }
        : inherited;
    aliases.set(file, own);
    return own;
  };
  const seen = new Set<string>();
  for (const importer of Object.keys(metafile.inputs)) {
    if (/^[a-z-]+:/.test(importer) || importer.includes("<")) continue;
    const from = path.dirname(path.resolve(root, importer));
    const pkg = configAt(from, CONFIGS[0] ?? []);
    if (pkg !== undefined) files.add(pkg);
    const ts = configAt(from, CONFIGS[1] ?? []);
    const alias = ts === undefined ? undefined : tsconfig(ts);
    for (const i of metafile.inputs[importer]?.imports ?? []) {
      // An import left unresolved (external) carries its specifier as `path`, with no `original`.
      const spec = i.original ?? (i.external === true ? i.path : undefined);
      if (spec === undefined || seen.has(`${from}\0${spec}`)) continue;
      seen.add(`${from}\0${spec}`);
      const plain = spec.split("?")[0] ?? spec;
      const named = bare(plain);
      if (named !== undefined && isNodeBuiltin(named.name)) continue;
      const query = i.path.startsWith("keel-query:") ? i.path.slice("keel-query:".length) : undefined;
      if (i.external !== true && query === undefined && /^[a-z-]+:/.test(i.path)) continue;
      const loaded = i.external === true ? undefined : (query ?? realOf(path.resolve(root, i.path)));
      if (i.external !== true && loaded === undefined) continue;
      if (named === undefined) {
        if (plain.startsWith("#")) continue;
        const c = query ?? upTo(candidates(path.resolve(from, plain)), loaded);
        if (c !== undefined) below(from, c);
        continue;
      }
      if (alias !== undefined) {
        const mapped: string[] = [plain];
        for (const [k, v] of Object.entries(alias.paths ?? {})) {
          const star = k.indexOf("*");
          const hit = star < 0 ? k === plain : plain.startsWith(k.slice(0, star)) && plain.endsWith(k.slice(star + 1));
          if (!hit) continue;
          const part = star < 0 ? "" : plain.slice(star, plain.length - (k.length - star - 1));
          for (const t of Array.isArray(v) ? v : []) if (typeof t === "string") mapped.push(t.replace("*", part));
        }
        for (const m of mapped) for (const c of candidates(path.resolve(alias.base, m))) add("stat", c);
      }
      walk(from, named, loaded);
    }
  }
  for (const r of reads) below(path.parse(r).root, r);
  const probes = [...out.values()].sort((a, b) => (a[1] === b[1] ? (a[0] < b[0] ? -1 : 1) : a[1] < b[1] ? -1 : 1));
  return { probes, files: [...files].sort() };
}
