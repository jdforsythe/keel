import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { KeyValueStorage } from "../KeyValueStorage.ts";

function load(file: string): Map<string, string> {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return new Map();
  }
  const parsed: unknown = JSON.parse(text);
  const data = new Map<string, string>();
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    throw new Error(`ctx.storage: ${file} is not a JSON object of strings; delete it to start empty`);
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string")
      throw new Error(`ctx.storage: ${file} is not a JSON object of strings; delete it to start empty`);
    data.set(key, value);
  }
  return data;
}

/**
 * Node-only `KeyValueStorage` kept in one JSON file, for `createCtx({ storage })`. The file is read on first use;
 * each `set` rewrites it whole through a temporary file and a rename, creating its directory. One process owns a file.
 */
export function fileStorage(file: string): KeyValueStorage {
  let data: Map<string, string> | undefined;
  const open = (): Map<string, string> => {
    data ??= load(file);
    return data;
  };
  return {
    get: async (key) => open().get(key) ?? null,
    set: async (key, value) => {
      const map = open();
      map.set(key, value);
      mkdirSync(dirname(file), { recursive: true });
      const tmp = `${file}.tmp`;
      writeFileSync(tmp, JSON.stringify(Object.fromEntries(map)));
      renameSync(tmp, file);
    },
  };
}
