import type { KeyValueStorage } from "@keel/ctx";
import { load } from "@tauri-apps/plugin-store";
import { cellStorage } from "./cellStorage.ts";

/**
 * k.persist's storage on `@tauri-apps/plugin-store`: the file `keel.json` in the app's data directory, loaded on the
 * first call (again after a failed load) and saved before a write resolves, so it is kept across app restarts.
 */
export function storeStorage(): KeyValueStorage {
  let opened: ReturnType<typeof load> | undefined;
  const store = (): ReturnType<typeof load> => {
    opened ??= load("keel.json", { autoSave: false, defaults: {} }).catch((e: unknown) => {
      opened = undefined;
      throw e;
    });
    return opened;
  };
  return cellStorage({
    get: async (key) => {
      const v: unknown = await (await store()).get(key);
      return typeof v === "string" ? v : null;
    },
    put: async (entries) => {
      const s = await store();
      for (const [key, value] of entries) await s.set(key, value);
      await s.save();
    },
  });
}
