import fs from "node:fs";
import path from "node:path";
import type { Diagnostic } from "../types/Diagnostic.ts";
import { CACHE_FORMAT } from "./CACHE_FORMAT.ts";
import type { FormatSite } from "./FormatSite.ts";
import type { Probe } from "./Probe.ts";
import type { TypeEntry } from "./TypeEntry.ts";
import { isRecord } from "./compat/isRecord.ts";

/** Entries kept in one folder (k.check-cache Entries); each write removes the least recently written beyond them. */
const KEEP = 4;
/** The largest entry written, as JSON text: 16 MiB. */
const MAX_BYTES = 16 * 1024 * 1024;

const KINDS = new Set(["r", "f", "d", "p", "l", "x"]);
const isProbe = (v: unknown): v is Probe =>
  Array.isArray(v) && v.length === 3 && KINDS.has(v[0]) && typeof v[1] === "string" && typeof v[2] === "string";

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

const isSite = (v: unknown): v is FormatSite =>
  isRecord(v) &&
  v.kind === "format" &&
  typeof v.path === "string" &&
  typeof v.formatAt === "number" &&
  typeof v.textAt === "number" &&
  Array.isArray(v.names) &&
  v.names.every((n) => typeof n === "string") &&
  (v.text === null || typeof v.text === "string") &&
  (v.owner === null || typeof v.owner === "string") &&
  (v.pkg === null || typeof v.pkg === "string");

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

function parseEntry(text: string): TypeEntry | undefined {
  const v: unknown = JSON.parse(text);
  if (
    !isRecord(v) ||
    v.format !== CACHE_FORMAT ||
    typeof v.key !== "string" ||
    !Array.isArray(v.probes) ||
    !Array.isArray(v.items) ||
    !isDates(v.dates)
  )
    return undefined;
  const probes = v.probes.filter(isProbe);
  const items = v.items.filter((i): i is Diagnostic | FormatSite => isDiagnostic(i) || isSite(i));
  if (probes.length !== v.probes.length || items.length !== v.items.length) return undefined;
  return { key: v.key, probes, items, dates: new Map(v.dates.map(([p, ns]) => [p, new Set(ns)])) };
}

/**
 * The type pass's entries kept in `dir` across processes (k.check-cache): `name` is the key's hash. `load` gives the
 * entry as written, or `undefined` for one that cannot be read, does not parse or lacks the entry shape; the caller
 * uses it only when the key it holds is the one looked up and its probes hold. `save` writes an entry of at most
 * 16 MiB to a temporary file and renames it into place, then removes the least recently written entries beyond 4 and
 * every other `*.tmp` file; a failed write is ignored. What is stored: paths, hashes and diagnostics.
 */
export function typeCache(dir: string, name: string) {
  const file = path.join(dir, `types-${name}.json`);
  return {
    load(): TypeEntry | undefined {
      try {
        return parseEntry(fs.readFileSync(file, "utf8"));
      } catch {
        return undefined;
      }
    },
    save(entry: TypeEntry): void {
      try {
        const dates = [...entry.dates].map(([p, s]) => [p, [...s]]);
        const text = JSON.stringify({
          format: CACHE_FORMAT,
          key: entry.key,
          probes: entry.probes,
          items: entry.items,
          dates,
        });
        if (Buffer.byteLength(text) > MAX_BYTES) return;
        fs.mkdirSync(dir, { recursive: true });
        const tmp = `${file}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, text);
        fs.renameSync(tmp, file);
        const own = path.basename(file);
        const names = fs.readdirSync(dir);
        for (const n of names) if (n.endsWith(".tmp")) fs.rmSync(path.join(dir, n), { force: true });
        const others = names
          .filter((n) => n.startsWith("types-") && n.endsWith(".json") && n !== own)
          .map((n) => ({ n, at: fs.statSync(path.join(dir, n), { throwIfNoEntry: false })?.mtimeMs ?? 0 }))
          .sort((a, b) => b.at - a.at);
        for (const { n } of others.slice(KEEP - 1)) fs.rmSync(path.join(dir, n), { force: true });
      } catch {
        // A cache that cannot be written is no cache.
      }
    },
  };
}
