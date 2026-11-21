import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCtx } from "../src/index.ts";
import { fileStorage } from "../src/node/index.ts";

const dirs: string[] = [];
const dir = (): string => {
  const d = mkdtempSync(join(tmpdir(), "keel-ctx-storage-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("ctx.storage backing (k.ctx, k.topology Local topology)", () => {
  it("fileStorage resolves null for a missing key and creates no file on read", async () => {
    const file = join(dir(), "nested", "a.json");
    expect(await fileStorage(file).get("k")).toBeNull();
    expect(() => readFileSync(file)).toThrow();
  });

  it("a value set survives a fresh fileStorage on the same file (a restart)", async () => {
    const file = join(dir(), "nested", "a.json");
    await fileStorage(file).set("k", "v1");
    await fileStorage(file).set("j", "v2");
    const again = fileStorage(file);
    expect(await again.get("k")).toBe("v1");
    expect(await again.get("j")).toBe("v2");
  });

  it("two files do not share keys", async () => {
    const d = dir();
    await fileStorage(join(d, "a.json")).set("k", "a");
    expect(await fileStorage(join(d, "b.json")).get("k")).toBeNull();
  });

  it("a file that is not a JSON object of strings rejects naming the file", async () => {
    const file = join(dir(), "bad.json");
    writeFileSync(file, '{"k":1}');
    await expect(fileStorage(file).get("k")).rejects.toThrow(file);
  });

  it("a read error other than a missing file rejects with its code and leaves the path untouched", async () => {
    const file = join(dir(), "isdir.json");
    mkdirSync(file);
    const store = fileStorage(file);
    await expect(store.get("k")).rejects.toThrow(`ctx.storage: ${file} cannot be read (EISDIR)`);
    await expect(store.set("k", "v")).rejects.toThrow("EISDIR");
    expect(statSync(file).isDirectory()).toBe(true);
    expect(() => readFileSync(`${file}.tmp`)).toThrow();
  });

  it("a file that is not JSON rejects without echoing its contents, and set does not overwrite it", async () => {
    const file = join(dir(), "corrupt.json");
    writeFileSync(file, "{not json SECRET-FRAGMENT");
    const store = fileStorage(file);
    const e = await store.get("k").catch((x: unknown) => x);
    expect(e).toBeInstanceOf(Error);
    expect(String(e)).toContain(`ctx.storage: ${file} is not a JSON object of strings; delete it to start empty`);
    expect(String(e)).not.toContain("SECRET-FRAGMENT");
    await expect(store.set("k", "v")).rejects.toThrow(file);
    expect(readFileSync(file, "utf8")).toBe("{not json SECRET-FRAGMENT");
  });

  it("createCtx({ drivers: { storage } }) backs ctx.storage in real mode", async () => {
    const file = join(dir(), "s.json");
    const ctx = createCtx({ mode: "real", drivers: { storage: fileStorage(file) } });
    await ctx.storage.set("k", "v");
    expect(await createCtx({ mode: "real", drivers: { storage: fileStorage(file) } }).storage.get("k")).toBe("v");
  });

  it("a sim ctx refuses a storage driver with E1605 and writes no file", () => {
    const file = join(dir(), "s.json");
    expect(() => createCtx({ mode: "sim", drivers: { storage: fileStorage(file) } })).toThrow(
      expect.objectContaining({ code: "E1605" }),
    );
    expect(() => readFileSync(file)).toThrow();
  });

  it("fileStorage commit rewrites the file only when it stores a value, and a fresh driver reads it", async () => {
    const file = join(dir(), "c.json");
    const store = fileStorage(file);
    expect(await store.commit([{ key: "k", expect: null }])).toBe(true);
    expect(() => readFileSync(file)).toThrow();
    expect(await store.commit([{ key: "k", expect: "x", value: "v" }])).toBe(false);
    expect(() => readFileSync(file)).toThrow();
    expect(await store.commit([{ key: "k", expect: null, value: "v" }])).toBe(true);
    expect(await fileStorage(file).read(["k", "j"])).toEqual(["v", null]);
  });

  it("a fileStorage write that fails leaves its contents as they were", async () => {
    const d = dir();
    const file = join(d, "s.json");
    const store = fileStorage(file);
    await store.set("k", "v1");
    mkdirSync(`${file}.tmp`);
    await expect(store.commit([{ key: "k", expect: "v1", value: "v2" }])).rejects.toThrow();
    await expect(store.set("k", "v3")).rejects.toThrow();
    expect(await store.read(["k"])).toEqual(["v1"]);
  });

  it.runIf(typeof localStorage === "undefined")(
    "without localStorage, real storage rejects saying which flag or option to use",
    async () => {
      const ctx = createCtx({ mode: "real" });
      await expect(ctx.storage.get("k")).rejects.toThrow(
        /--localstorage-file=.*createCtx\(\{ drivers: \{ storage \} \}\)/,
      );
    },
  );
});
