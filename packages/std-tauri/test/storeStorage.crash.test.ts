// A crash inside a save, over a stand-in of tauri-plugin-store 2.5.1's file: `save` is `fs::write` (truncate, then
// write), and a load that fails is ignored, so a file cut short opens as an empty store. After the crash a new driver
// (the restart) must read the earlier or the new value of the key, never neither.
import { expect, test } from "vitest";
import { storeStorage } from "../src/internal/storeStorage.ts";

/** The store file as bytes, and a plugin-store stand-in over it; `crashNextSave` makes the next save stop after the truncate. */
function pluginStoreFile() {
  const file = { text: "", crashNextSave: false };
  const open = async () => {
    let memory = new Map<string, unknown>();
    try {
      const parsed: unknown = JSON.parse(file.text);
      if (typeof parsed === "object" && parsed !== null) memory = new Map(Object.entries(parsed));
    } catch {}
    return {
      get: async (k: string) => memory.get(k),
      set: async (k: string, v: unknown) => {
        memory.set(k, v);
      },
      delete: async (k: string) => memory.delete(k),
      save: async () => {
        file.text = "";
        if (file.crashNextSave) throw new Error("process killed");
        file.text = JSON.stringify(Object.fromEntries(memory));
      },
    };
  };
  return { file, open };
}

// Fails: plugin-store's save truncates keel.json before it writes, and a crash there reopens as an empty store.
test.fails("a crash inside a save leaves the earlier or the new value", async () => {
  const { file, open } = pluginStoreFile();
  const before = storeStorage(open);
  await before.set("keel.outbox", "earlier");
  file.crashNextSave = true;
  await before.set("keel.outbox", "new").catch(() => undefined);
  file.crashNextSave = false;
  const after = storeStorage(open);
  expect(["earlier", "new"]).toContain(await after.get("keel.outbox"));
});
