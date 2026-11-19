import fs from "node:fs";
import path from "node:path";

const CONDITIONS = ["node", "import", "default"];

/** The `exports` target for the ESM conditions `node`, `import`, `default` (the `.` entry of a subpath map). */
function target(x: unknown): string | undefined {
  if (typeof x === "string") return x;
  if (Array.isArray(x)) return x.map(target).find((t) => t !== undefined);
  if (typeof x !== "object" || x === null) return undefined;
  const keys = Object.keys(x);
  if (keys.some((k) => k.startsWith("."))) return target(Reflect.get(x, "."));
  for (const k of keys) {
    const t = CONDITIONS.includes(k) ? target(Reflect.get(x, k)) : undefined;
    if (t !== undefined) return t;
  }
  return undefined;
}

/** A field of a parsed `package.json`. */
const field = (manifest: unknown, k: string): unknown =>
  typeof manifest === "object" && manifest !== null ? Reflect.get(manifest, k) : undefined;

/**
 * The real entry file of `dep` as an ESM import from `dir` sees it, with the package's real directory: the first
 * `node_modules/<dep>/package.json` in `dir` or an ancestor (no NODE_PATH, no global folders), then its `exports` by
 * Node's conditions (an `exports` target starts with `./` and has no `.`, `..`, `node_modules` or empty segment), else
 * `main`, else `index.js`. Undefined when there is none or its real path is outside the package's real directory.
 */
export function entryOf(dir: string, dep: string, sub = "."): [file: string, pkg: string] | undefined {
  for (let d = dir; ; d = path.dirname(d)) {
    const pkg = path.join(d, "node_modules", dep);
    const json = path.join(pkg, "package.json");
    if (fs.existsSync(json)) {
      let manifest: unknown;
      try {
        manifest = JSON.parse(fs.readFileSync(json, "utf8"));
      } catch {
        return undefined;
      }
      const exp = field(manifest, "exports");
      const main = field(manifest, "main");
      let rel = sub !== "." || exp !== undefined ? target(sub === "." ? exp : field(exp, sub)) : undefined;
      if (rel !== undefined && (!rel.startsWith("./") || /(^|[\\/])(\.\.?|node_modules)?([\\/]|$)/i.test(rel.slice(2))))
        rel = undefined;
      else if (sub === "." && exp === undefined) rel = typeof main === "string" ? main : "index.js";
      const file = rel === undefined ? undefined : path.resolve(pkg, rel);
      if (file === undefined || !fs.existsSync(file)) return undefined;
      const [real, root] = [fs.realpathSync(file), fs.realpathSync(pkg)];
      return real.startsWith(root + path.sep) ? [real, root] : undefined;
    }
    if (path.dirname(d) === d) return undefined;
  }
}
