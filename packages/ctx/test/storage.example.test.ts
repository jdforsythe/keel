import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

  it("createCtx({ storage }) backs ctx.storage in real mode", async () => {
    const file = join(dir(), "s.json");
    const ctx = createCtx({ mode: "real", storage: fileStorage(file) });
    await ctx.storage.set("k", "v");
    expect(await createCtx({ mode: "real", storage: fileStorage(file) }).storage.get("k")).toBe("v");
  });

  it("sim ctx storage stays in memory even when storage is given", async () => {
    const file = join(dir(), "s.json");
    const ctx = createCtx({ mode: "sim", storage: fileStorage(file) });
    await ctx.storage.set("k", "v");
    expect(() => readFileSync(file)).toThrow();
  });

  it.runIf(typeof localStorage === "undefined")(
    "without localStorage, real storage rejects saying which flag or option to use",
    async () => {
      const ctx = createCtx({ mode: "real" });
      await expect(ctx.storage.get("k")).rejects.toThrow(/--localstorage-file=.*createCtx\(\{ storage \}\)/);
    },
  );
});
