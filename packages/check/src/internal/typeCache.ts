import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { Typed } from "./Typed.ts";
import { isRecord } from "./compat/isRecord.ts";

/** Entries kept in one cache directory; the oldest go first. */
const KEEP = 32;

type Stamp = readonly [string, number];
type Entry = { readonly result: Typed; readonly reads: readonly Stamp[] };

const mtimeOf = (file: string): number => fs.statSync(file, { throwIfNoEntry: false })?.mtimeMs ?? -1;

/** Every file under `dir` with its mtime and size: the check's own code, so a changed check misses every entry. */
function codeStamp(dir: string): string {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else {
        const s = fs.statSync(p);
        out.push(`${p}:${s.mtimeMs}:${s.size}`);
      }
    }
  };
  walk(dir);
  return out.sort().join("\n");
}

let code: string | undefined;
/** The `src` (or built `dist/src`) folder of this package, stamped once per process. */
const ownCode = (): string => {
  code ??= codeStamp(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
  return code;
};

const isStamp = (v: unknown): v is Stamp =>
  Array.isArray(v) && v.length === 2 && typeof v[0] === "string" && typeof v[1] === "number";

const isDiagnostic = (v: unknown): v is Diagnostic =>
  isRecord(v) &&
  v.kind === "diag" &&
  typeof v.code === "string" &&
  typeof v.path === "string" &&
  typeof v.line === "number" &&
  typeof v.col === "number" &&
  typeof v.message === "string" &&
  (v.see === undefined || typeof v.see === "string") &&
  (v.fix === undefined || typeof v.fix === "string");

const isDates = (v: unknown): v is [string, number[]][] =>
  Array.isArray(v) &&
  v.every(
    (d) =>
      Array.isArray(d) &&
      d.length === 2 &&
      typeof d[0] === "string" &&
      Array.isArray(d[1]) &&
      d[1].every((n) => typeof n === "number"),
  );

function parseEntry(text: string): Entry | undefined {
  const v: unknown = JSON.parse(text);
  if (!isRecord(v) || !Array.isArray(v.reads) || !Array.isArray(v.diagnostics) || !isDates(v.dates)) return undefined;
  const reads = v.reads.filter(isStamp);
  const diagnostics = v.diagnostics.filter(isDiagnostic);
  if (reads.length !== v.reads.length || diagnostics.length !== v.diagnostics.length) return undefined;
  return { reads, result: { diagnostics, dates: new Map(v.dates.map(([p, ns]) => [p, new Set(ns)])) } };
}

/**
 * The type pass's results kept on disk across processes, so `keel build` then `keel check` over unchanged sources
 * runs one TypeScript program. An entry is named by a hash of the pass's input key, this package's code and the
 * TypeScript version, and holds the result with the mtime of every disk file the program read plus the project's
 * `package.json` and `node_modules` folder (an install that adds a package changes the folder). It is used only while
 * each of those mtimes holds. Any failure to read or write is a miss: the cache never changes a result.
 */
export function typeCache(dir: string, key: string, tsVersion: string, root: string) {
  const name = createHash("sha256").update(`${tsVersion}\u0000${ownCode()}\u0000${key}`).digest("hex").slice(0, 32);
  const file = path.join(dir, `types-${name}.json`);
  const project = [path.join(root, "package.json"), path.join(root, "node_modules")];
  return {
    load(): Typed | undefined {
      try {
        const entry = parseEntry(fs.readFileSync(file, "utf8"));
        return entry?.reads.every(([f, m]) => mtimeOf(f) === m) === true ? entry.result : undefined;
      } catch {
        return undefined;
      }
    },
    save(result: Typed, reads: readonly Stamp[]): void {
      try {
        // The folder first: creating it under `node_modules` changes that folder's mtime.
        fs.mkdirSync(dir, { recursive: true });
        const all = [...reads, ...project.map((f): Stamp => [f, mtimeOf(f)])];
        const dates = [...result.dates].map(([p, s]) => [p, [...s]]);
        const tmp = `${file}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify({ reads: all, diagnostics: result.diagnostics, dates }));
        fs.renameSync(tmp, file);
        const entries = fs
          .readdirSync(dir)
          .filter((n) => n.startsWith("types-") && n.endsWith(".json"))
          .map((n) => ({ n, at: mtimeOf(path.join(dir, n)) }))
          .sort((a, b) => b.at - a.at);
        for (const { n } of entries.slice(KEEP)) fs.rmSync(path.join(dir, n), { force: true });
      } catch {
        // A cache that cannot be written is no cache.
      }
    },
  };
}
