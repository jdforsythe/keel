// Spec: k.persist, Conformance "A second ctx on `f` reads a value set through `createCtx({ mode: 'real', drivers: { storage: fileStorage(f) } })`."
// Seed 1337.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCtx } from "@keel/ctx";
import { fileStorage } from "@keel/ctx/node";
import fc from "fast-check";
import { afterAll, expect, it, test } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "keel-storage-0088-"));
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

let n = 0;

test("A second ctx on `f` reads a value set through `createCtx({ mode: 'real', drivers: { storage: fileStorage(f) } })`", async () => {
  await fc.assert(
    fc.asyncProperty(fc.string(), fc.string(), async (key, value) => {
      const f = join(dir, `s${String(n++)}.json`);
      const first = createCtx({ mode: "real", drivers: { storage: fileStorage(f) } });
      await first.storage.set(key, value);
      const second = createCtx({ mode: "real", drivers: { storage: fileStorage(f) } });
      expect(await second.storage.get(key)).toBe(value);
    }),
    { seed: 1337, numRuns: 25 },
  );
});

// A `sim` ctx given a storage driver throws E1605 (k.persist Drivers).
it("`createCtx({ mode: 'sim', drivers: { storage } })` throws E1605 and calls no `storage` method", async () => {
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
    read(keys: readonly string[]): Promise<(string | null)[]> {
      calls++;
      return Promise.resolve(keys.map(() => null));
    },
    commit(): Promise<boolean> {
      calls++;
      return Promise.resolve(true);
    },
  };
  const codeOf = (e: unknown): unknown => (typeof e === "object" && e !== null && "code" in e ? e.code : undefined);
  await fc.assert(
    fc.asyncProperty(fc.string(), fc.string(), async (key, value) => {
      let code: unknown;
      try {
        const sim = createCtx({ mode: "sim", seed: 1337, drivers: { storage: counting } });
        await sim.storage.set(key, value);
        await sim.storage.get(key);
      } catch (e) {
        code = codeOf(e);
      }
      expect(code).toBe("E1605");
      expect(calls).toBe(0);
    }),
    { seed: 1337, numRuns: 25 },
  );
});
