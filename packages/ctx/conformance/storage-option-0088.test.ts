// Spec: k.ctx, clause "A second ctx on `f` reads a value set through `createCtx({ storage: fileStorage(f) })`; sim never calls `storage`."
// Seed 1337.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCtx } from "@keel/ctx";
import { fileStorage } from "@keel/ctx/node";
import fc from "fast-check";
import { afterAll, expect, test } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "keel-storage-0088-"));
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

let n = 0;

test("A second ctx on `f` reads a value set through `createCtx({ storage: fileStorage(f) })`; sim never calls `storage`", async () => {
  await fc.assert(
    fc.asyncProperty(fc.string(), fc.string(), async (key, value) => {
      const f = join(dir, `s${String(n++)}.json`);
      const first = createCtx({ mode: "real", storage: fileStorage(f) });
      await first.storage.set(key, value);
      const second = createCtx({ mode: "real", storage: fileStorage(f) });
      expect(await second.storage.get(key)).toBe(value);
    }),
    { seed: 1337, numRuns: 25 },
  );

  let calls = 0;
  const counting = {
    get(): Promise<string | null> {
      calls++;
      return Promise.resolve(null);
    },
    set(): Promise<void> {
      calls++;
      return Promise.resolve();
    },
  };
  await fc.assert(
    fc.asyncProperty(fc.string(), fc.string(), async (key, value) => {
      const sim = createCtx({ mode: "sim", seed: 1337, storage: counting });
      await sim.storage.set(key, value);
      await sim.storage.get(key);
      expect(calls).toBe(0);
    }),
    { seed: 1337, numRuns: 25 },
  );
});
