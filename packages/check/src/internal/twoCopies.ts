import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import { twoCopiesMessage } from "./twoCopiesMessage.ts";

/** The kernel packages that make identities, one copy each per realm (k.realm One copy). */
const KERNEL = new Set(["@keel/schema", "@keel/store", "@keel/router", "@keel/server"]);
/** The fields whose names resolve from a package's folder; the project's own `devDependencies` too. */
const FIELDS = ["dependencies", "optionalDependencies", "peerDependencies"] as const;

/** The dependency names of a `package.json` text's `fields`; none when it does not parse. */
function depNames(text: string, fields: readonly string[]): string[] {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return [];
  }
  if (typeof value !== "object" || value === null) return [];
  const names: string[] = [];
  for (const field of fields) {
    const deps: unknown = Reflect.get(value, field);
    if (typeof deps === "object" && deps !== null) names.push(...Object.keys(deps));
  }
  return names;
}

/**
 * E1765 at check (k.realm One copy): at `<dir>package.json`, one per kernel package its dependencies, followed as Node
 * resolves them, reach in two folders, message `two copies of <name> in one realm: <first> and <second>`, the folders
 * relative to the project in the order the walk meets them. A folder is read from `files` first, then, with `root`
 * given, from the disk under it, where a folder is one copy by its real path. Nothing for a project with no
 * `package.json` among `files`.
 */
export function twoCopies(dir: string, files: readonly SourceFile[], root?: string): Diagnostic[] {
  const own = files.find((f) => f.path === `${dir}package.json`);
  if (own === undefined) return [];
  const top = root === undefined ? "/" : path.resolve(root);
  const base = path.posix.join(top, dir);
  const memory = new Map<string, string>();
  for (const f of files) if (f.path.endsWith("package.json")) memory.set(path.posix.join(top, f.path), f.source);
  /** A folder's `package.json` text and real path, `undefined` when there is none. */
  const read = (folder: string): { text: string; at: string } | undefined => {
    const text = memory.get(path.posix.join(folder, "package.json"));
    if (text !== undefined) return { text, at: folder };
    if (root === undefined) return undefined;
    try {
      return { text: readFileSync(path.join(folder, "package.json"), "utf8"), at: realpathSync(folder) };
    } catch {
      return undefined;
    }
  };
  /** Where `name` resolves from `from`: the nearest `node_modules/<name>/` of it or a folder above it. */
  const resolve = (from: string, name: string): { folder: string; text: string; at: string } | undefined => {
    for (let at = from; ; at = path.posix.dirname(at)) {
      if (path.posix.basename(at) !== "node_modules") {
        const folder = path.posix.join(at, "node_modules", name);
        const found = read(folder);
        if (found !== undefined) return { folder, ...found };
      }
      if (at === path.posix.dirname(at)) return undefined;
    }
  };
  const copies = new Map<string, { at: string; folder: string }[]>();
  const seen = new Set<string>([base]);
  const queue: { from: string; text: string; top: boolean }[] = [{ from: base, text: own.source, top: true }];
  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    if (item === undefined) break;
    for (const name of depNames(item.text, item.top ? [...FIELDS, "devDependencies"] : FIELDS)) {
      const found = resolve(item.from, name);
      if (found === undefined) continue;
      if (KERNEL.has(name)) {
        const list = copies.get(name) ?? [];
        if (!list.some((c) => c.at === found.at)) list.push({ at: found.at, folder: found.folder });
        copies.set(name, list);
      }
      if (seen.has(found.at)) continue;
      seen.add(found.at);
      // A folder resolves its own names from its real path, as Node does.
      queue.push({ from: found.at, text: found.text, top: false });
    }
  }
  const out: Diagnostic[] = [];
  for (const [name, list] of copies) {
    const [first, second] = list;
    if (first === undefined || second === undefined) continue;
    const shown = (folder: string): string => path.posix.relative(base, folder);
    const message = twoCopiesMessage(name, shown(first.folder), shown(second.folder));
    out.push({ kind: "diag", code: "E1765", path: `${dir}package.json`, line: 1, col: 1, message, see: "k.realm" });
  }
  return out;
}
