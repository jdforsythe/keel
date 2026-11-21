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
 * The `exports` target of subpath `sub` (`./x`) by Node's rule: the exact key, else the key with one `*` whose prefix
 * and suffix `sub` carries, the longest prefix first and then the longest key, with `*` in the target replaced by what
 * it matched. The chosen key alone decides: a `null` target there exports nothing.
 */
function subpath(exp: unknown, sub: string): string | undefined {
  if (typeof exp !== "object" || exp === null || Array.isArray(exp)) return undefined;
  if (Object.hasOwn(exp, sub) && !sub.includes("*")) return target(Reflect.get(exp, sub));
  let best: [key: string, star: number] | undefined;
  for (const key of Object.keys(exp)) {
    const star = key.indexOf("*");
    if (star < 0 || star !== key.lastIndexOf("*") || sub.length < key.length) continue;
    if (!sub.startsWith(key.slice(0, star)) || !sub.endsWith(key.slice(star + 1))) continue;
    if (best === undefined || star > best[1] || (star === best[1] && key.length > best[0].length)) best = [key, star];
  }
  if (best === undefined) return undefined;
  const [key, star] = best;
  const match = sub.slice(star, sub.length - (key.length - star - 1));
  return target(Reflect.get(exp, key))?.replaceAll("*", () => match);
}

/**
 * The real file of export `sub` (`.` or `./x`) of the package in directory `pkg`, with the package's real directory:
 * its `exports` by Node's conditions and, for a subpath, Node's subpath patterns (an `exports` target starts with `./`
 * and has no `.`, `..`, `node_modules` or empty segment), else for `.` `main`, else `index.js`. Undefined when
 * `package.json` does not parse, there is no such export, or its real path is outside the package's real directory.
 */
export function exportOf(pkg: string, sub = "."): [file: string, pkg: string] | undefined {
  let manifest: unknown;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(pkg, "package.json"), "utf8"));
  } catch {
    return undefined;
  }
  const exp = field(manifest, "exports");
  const main = field(manifest, "main");
  let rel = sub !== "." || exp !== undefined ? (sub === "." ? target(exp) : subpath(exp, sub)) : undefined;
  if (rel !== undefined && (!rel.startsWith("./") || /(^|[\\/])(\.\.?|node_modules)?([\\/]|$)/i.test(rel.slice(2))))
    rel = undefined;
  else if (sub === "." && exp === undefined) rel = typeof main === "string" ? main : "index.js";
  const file = rel === undefined ? undefined : path.resolve(pkg, rel);
  if (file === undefined || !fs.existsSync(file)) return undefined;
  const [real, root] = [fs.realpathSync(file), fs.realpathSync(pkg)];
  return real.startsWith(root + path.sep) ? [real, root] : undefined;
}
