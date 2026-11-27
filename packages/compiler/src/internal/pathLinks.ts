import fs from "node:fs";
import path from "node:path";
import type { Metafile } from "esbuild";
import { isNodeBuiltin } from "./isNodeBuiltin.ts";

/** The file extensions and index files a specifier without one may name, as the bundle resolves them. */
const EXTS = [".tsx", ".ts", ".jsx", ".js", ".mts", ".cts", ".mjs", ".cjs", ".css", ".json"];
/** A `.js`-family specifier may name the TypeScript file beside it. */
const TS_OF: Readonly<Record<string, readonly string[]>> = {
  ".js": [".ts", ".tsx"],
  ".jsx": [".tsx"],
  ".mjs": [".mts"],
  ".cjs": [".cts"],
};

const isRecord = (x: unknown): x is Readonly<Record<string, unknown>> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

/** The package a bare specifier names and the rest of it: `@scope/name` or `name`; undefined for any other. */
function bare(spec: string): { name: string; sub: string } | undefined {
  if (spec.startsWith(".") || spec.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(spec)) return undefined;
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
 * Every symbolic link on the path through the project to each file a build-time evaluation bundle loaded (k.derived
 * Derivation cache), absolute and sorted: for each import in `metafile`, the path its specifier names from the
 * importer's folder (a relative one) or from the first `<folder>/node_modules/<name>` walking up from it (a bare one,
 * then through the package's `exports`, `main` or the subpath), the one of its candidates whose real path is the file
 * the bundle loaded; each link below the folder it starts from is listed, and the `node_modules/<name>` entry itself,
 * a link or not, so a folder put in its place is seen too. `reads` add each link on each path the code read by.
 */
export function pathLinks(root: string, metafile: Metafile, reads: readonly string[] = []): string[] {
  const out = new Set<string>();
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
  /** Each link on `p` below the folder `from`. */
  const below = (from: string, p: string): void => {
    for (let d = p; d.length > from.length && d.startsWith(from); d = path.dirname(d)) if (linkAt(d)) out.add(d);
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
  const seen = new Set<string>();
  for (const [importer, input] of Object.entries(metafile.inputs)) {
    if (/^[a-z-]+:/.test(importer) || importer.includes("<")) continue;
    const from = path.dirname(path.resolve(root, importer));
    for (const i of input.imports) {
      const spec = i.original;
      if (spec === undefined || i.external === true || seen.has(`${from}\0${spec}`)) continue;
      seen.add(`${from}\0${spec}`);
      const query = i.path.startsWith("keel-query:") ? i.path.slice("keel-query:".length) : undefined;
      if (query === undefined && /^[a-z-]+:/.test(i.path)) continue;
      const loaded = query ?? realOf(path.resolve(root, i.path));
      if (loaded === undefined) continue;
      const named = bare(spec.split("?")[0] ?? spec);
      if (named === undefined) {
        const base = path.resolve(from, spec.split("?")[0] ?? spec);
        const c = query ?? candidates(base).find((p) => realOf(p) === loaded);
        if (c !== undefined) below(from, c);
        continue;
      }
      if (isNodeBuiltin(named.name)) continue;
      for (let d = from; ; d = path.dirname(d)) {
        const at = path.join(d, "node_modules", named.name);
        const dir = realOf(at);
        if (dir !== undefined || linkAt(at)) {
          out.add(at);
          below(d, at);
          const tried = targets(pkgOf(at), named.sub).flatMap((t) => candidates(path.join(at, t)));
          const inside = dir !== undefined && loaded.startsWith(`${dir}${path.sep}`) ? loaded.slice(dir.length) : "";
          const c = [...tried, ...(inside === "" ? [] : [at + inside])].find((p) => realOf(p) === loaded);
          if (c !== undefined) below(at, c);
          break;
        }
        if (path.dirname(d) === d) break;
      }
    }
  }
  for (const r of reads) below(path.parse(r).root, r);
  return [...out].sort();
}
