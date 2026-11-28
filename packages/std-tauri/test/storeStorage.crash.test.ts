// A crash inside a save, over a stand-in of tauri-plugin-store 2.5.1's files (`save` truncates, then writes): after
// the crash a new driver (the restart) reads the earlier or the new value of the key, never neither.
import { describe, expect, test } from "vitest";
import { storeStorage } from "../src/internal/storeStorage.ts";
import { pluginStoreFiles } from "./pluginStoreFiles.ts";

describe("storeStorage across a crash", () => {
  test("a crash inside a save leaves the earlier or the new value", async () => {
    const f = pluginStoreFiles();
    const before = storeStorage(f.open);
    await before.set("keel.outbox", "earlier");
    for (const cut of [0, 1, 40, 200, 400]) {
      f.cutAfter(cut);
      await before.set("keel.outbox", "new").catch(() => undefined);
      f.heal();
      expect(["earlier", "new"]).toContain(await storeStorage(f.open).get("keel.outbox"));
    }
  });

  test("a crash inside the first save reads as the empty store it was", async () => {
    const f = pluginStoreFiles();
    f.cutAfter(3);
    await expect(storeStorage(f.open).set("k", "v")).rejects.toBe(f.killed);
    f.heal();
    expect([...f.files.keys()]).toEqual(["keel.b.json"]);
    expect(await storeStorage(f.open).get("k")).toBeNull();
  });

  test("a write saves keel.b.json, then keel.json, each a whole copy", async () => {
    const f = pluginStoreFiles();
    const st = storeStorage(f.open);
    await st.set("k", "v");
    expect(f.files.get("keel.json")).toBe(f.files.get("keel.b.json"));
    expect(f.files.get("keel.json")).toContain('\\"k\\":\\"v\\"');
  });

  test("a damaged keel.json falls back to a whole keel.b.json", async () => {
    const f = pluginStoreFiles();
    await storeStorage(f.open).set("k", "v");
    f.files.set("keel.json", '{"keel":{"gen"');
    expect(await storeStorage(f.open).get("k")).toBe("v");
  });

  test("the newer whole copy wins", async () => {
    const f = pluginStoreFiles();
    const st = storeStorage(f.open);
    await st.set("k", "1");
    const older = f.files.get("keel.json") ?? "";
    await st.set("k", "2");
    f.files.set("keel.json", older);
    expect(await storeStorage(f.open).get("k")).toBe("2");
  });

  test("a copy whose checksum does not match is not read", async () => {
    const f = pluginStoreFiles();
    await storeStorage(f.open).set("k", "v");
    const whole = f.files.get("keel.json") ?? "";
    f.files.set("keel.b.json", whole.replace('\\"v\\"', '\\"w\\"'));
    f.files.set("keel.json", "");
    await expect(storeStorage(f.open).get("k")).rejects.toThrow(/hold no whole copy/);
  });

  test("files holding no whole copy reject every call and are not overwritten", async () => {
    const cases: [string, string | undefined][] = [
      ["", ""],
      ["{}x", undefined],
      ['{"a":"1"}', undefined],
      ['{"keel":{"gen":1}}', "{"],
    ];
    for (const [main, backup] of cases) {
      const f = pluginStoreFiles();
      f.files.set("keel.json", main);
      if (backup !== undefined) f.files.set("keel.b.json", backup);
      const st = storeStorage(f.open);
      await expect(st.get("k")).rejects.toThrow(/keel\.json and keel\.b\.json hold no whole copy/);
      await expect(st.set("k", "v")).rejects.toThrow(/hold no whole copy/);
      expect(f.files.get("keel.json")).toBe(main);
      expect(f.files.get("keel.b.json")).toBe(backup);
    }
  });

  test("a file the plugin cannot read for another reason rejects, naming the file", async () => {
    const f = pluginStoreFiles();
    const st = storeStorage(async (path) => {
      const s = await f.open(path);
      return {
        ...s,
        reload: async () => {
          throw "Permission denied (os error 13)";
        },
      };
    });
    await expect(st.get("k")).rejects.toThrow("ctx.storage: keel.json cannot be read");
  });
});
