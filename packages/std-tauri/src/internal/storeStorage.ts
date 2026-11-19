import type { KeyValueStorage } from "@keel/ctx";
import { load } from "@tauri-apps/plugin-store";
import { cellStorage } from "./cellStorage.ts";

interface Store {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
  save(): Promise<void>;
}

/**
 * k.persist's storage on `@tauri-apps/plugin-store`: the file `keel.json` in the app's data directory, loaded on the
 * first call (again after a failed load) and saved before a write resolves, so it is kept across app restarts. A write
 * that fails puts back the values it replaced in memory before it rejects; when putting them back fails too, the next
 * call puts them back first, so no call reads a value the file was not given.
 */
export function storeStorage(
  open: () => Promise<Store> = () => load("keel.json", { autoSave: false, defaults: {} }),
): KeyValueStorage {
  let opened: Promise<Store> | undefined;
  let undo: [string, unknown][] = [];
  const store = async (): Promise<Store> => {
    opened ??= open().catch((e: unknown) => {
      opened = undefined;
      throw e;
    });
    const s = await opened;
    for (const [key, value] of undo) await (value === undefined ? s.delete(key) : s.set(key, value));
    undo = [];
    return s;
  };
  return cellStorage({
    get: async (key) => {
      const v = await (await store()).get(key);
      return typeof v === "string" ? v : null;
    },
    put: async (entries) => {
      const s = await store();
      const was: [string, unknown][] = [];
      for (const [key] of entries) was.push([key, await s.get(key)]);
      try {
        for (const [key, value] of entries) await s.set(key, value);
        await s.save();
      } catch (e) {
        undo = was;
        await store().catch(() => undefined);
        throw e;
      }
    },
  });
}
