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
 * The real entry file of `dep` as an ESM import from `dir` sees it: the first `node_modules/<dep>/package.json` in
 * `dir` or an ancestor (no NODE_PATH, no global folders), then its `exports` by ESM conditions, else `main`, else
 * `index.js`. Undefined when there is none.
 */
export function entryOf(dir: string, dep: string, sub = "."): string | undefined {
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
      const rel =
        sub !== "."
          ? target(field(exp, sub))
          : exp === undefined
            ? typeof main === "string"
              ? main
              : "index.js"
            : target(exp);
      const file = rel === undefined ? undefined : path.resolve(pkg, rel);
      return file !== undefined && fs.existsSync(file) ? fs.realpathSync(file) : undefined;
    }
    if (path.dirname(d) === d) return undefined;
  }
}
