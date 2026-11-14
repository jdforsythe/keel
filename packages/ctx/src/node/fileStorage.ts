import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { KeyValueStorage } from "../KeyValueStorage.ts";
import { applyCommit } from "../internal/applyCommit.ts";

const codeOf = (e: unknown): unknown => (typeof e === "object" && e !== null && "code" in e ? e.code : undefined);

/** A missing file is an empty store; any other read error, or contents that are not a JSON object of strings, throws. */
function load(file: string): Map<string, string> {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (e) {
    const code = codeOf(e);
    if (code === "ENOENT") return new Map();
    throw new Error(`ctx.storage: ${file} cannot be read (${typeof code === "string" ? code : "unknown"})`);
  }
  const bad = `ctx.storage: ${file} is not a JSON object of strings; delete it to start empty`;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(bad);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error(bad);
  const data = new Map<string, string>();
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string") throw new Error(bad);
    data.set(key, value);
  }
  return data;
}

/**
 * Node-only storage driver kept in one JSON file, for `createCtx({ drivers: { storage } })` (k.persist). The file is
 * read on first use; each `set`, and each `commit` that stores a value, rewrites it whole through a temporary file and
 * a rename, creating its directory, and only then takes the new contents as current. A missing file is empty; a file
 * that cannot be read or parsed rejects every call and is never overwritten. For development and single-process use:
 * one process owns a file.
 */
export function fileStorage(file: string): KeyValueStorage {
  let data: Map<string, string> | undefined;
  const open = (): Map<string, string> => {
    data ??= load(file);
    return data;
  };
  const save = (next: Map<string, string>): void => {
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify(Object.fromEntries(next)));
    renameSync(tmp, file);
    data = next;
  };
  return {
    get: async (key) => open().get(key) ?? null,
    set: async (key, value) => {
      save(new Map(open()).set(key, value));
    },
    read: async (keys) => {
      const map = open();
      return keys.map((k) => map.get(k) ?? null);
    },
    commit: async (writes) => {
      const map = open();
      const next = new Map(map);
      const ok = applyCommit(
        (k) => map.get(k) ?? null,
        (k, v) => next.set(k, v),
        writes,
      );
      if (ok && writes.some((w) => w.value !== undefined)) save(next);
      return ok;
    },
  };
}
