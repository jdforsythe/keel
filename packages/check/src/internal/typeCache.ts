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

const KINDS: readonly Probe[0][] = ["r", "f", "d", "p", "l", "x"];
/** `v` as a probe, or `undefined` when it has another shape. */
const probeOf = (v: unknown): Probe | undefined => {
  if (!Array.isArray(v) || v.length !== 3) return undefined;
  const [k, question, answer]: unknown[] = v;
  const kind = KINDS.find((x) => x === k);
  return kind !== undefined && typeof question === "string" && typeof answer === "string"
    ? [kind, question, answer]
    : undefined;
};

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

/** `v` as the offsets by path a cache entry keeps (`[path, offsets][]`), or `undefined` when it has another shape. */
const datesOf = (v: unknown): [string, number[]][] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const out: [string, number[]][] = [];
  for (const d of v) {
    if (!Array.isArray(d) || d.length !== 2) return undefined;
    const [p, ns]: unknown[] = d;
    if (typeof p !== "string" || !Array.isArray(ns)) return undefined;
    const offsets = ns.flatMap((n: unknown) => (typeof n === "number" ? [n] : []));
    if (offsets.length !== ns.length) return undefined;
    out.push([p, offsets]);
  }
  return out;
};

function parseEntry(text: string): TypeEntry | undefined {
  const v: unknown = JSON.parse(text);
  if (
    !isRecord(v) ||
    v.format !== CACHE_FORMAT ||
    typeof v.key !== "string" ||
    !Array.isArray(v.probes) ||
    !Array.isArray(v.items)
  )
    return undefined;
  const dates = datesOf(v.dates);
  const schemeSelects = datesOf(v.schemeSelects);
  const themeSelects = datesOf(v.themeSelects);
  const boxes = datesOf(v.boxes);
  const keelThrows = datesOf(v.keelThrows);
  if (
    dates === undefined ||
    schemeSelects === undefined ||
    themeSelects === undefined ||
    boxes === undefined ||
    keelThrows === undefined
  )
    return undefined;
  const probes = v.probes.flatMap((p: unknown) => {
    const probe = probeOf(p);
    return probe === undefined ? [] : [probe];
  });
  const items = v.items.filter((i): i is Diagnostic | FormatSite => isDiagnostic(i) || isSite(i));
  if (probes.length !== v.probes.length || items.length !== v.items.length) return undefined;
  const sets = (list: [string, number[]][]) => new Map(list.map(([p, ns]) => [p, new Set(ns)]));
  return {
    key: v.key,
    probes,
    items,
    dates: sets(dates),
    schemeSelects: sets(schemeSelects),
    themeSelects: sets(themeSelects),
    boxes: sets(boxes),
    keelThrows: sets(keelThrows),
  };
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
        const schemeSelects = [...entry.schemeSelects].map(([p, s]) => [p, [...s]]);
        const keelThrows = [...entry.keelThrows].map(([p, s]) => [p, [...s]]);
        const themeSelects = [...entry.themeSelects].map(([p, s]) => [p, [...s]]);
        const boxes = [...entry.boxes].map(([p, s]) => [p, [...s]]);
        const text = JSON.stringify({
          format: CACHE_FORMAT,
          key: entry.key,
          probes: entry.probes,
          items: entry.items,
          dates,
          schemeSelects,
          themeSelects,
          boxes,
          keelThrows,
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
