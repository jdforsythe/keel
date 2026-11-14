// Spec: k.persist, Conformance "`createCtx({ mode: 'sim', drivers: {} })` throws E1605; a `commit` naming one key twice throws E1606."
// Spec: k.persist, Rules "E1605 `drivers` on a `sim` ctx (throws)"
// Spec: k.persist, Rules "E1606 one key twice in a `commit` (throws)"
// Seed: 1337.
// A `commit` is asynchronous: whether E1606 is thrown synchronously or by the returned promise is not stated, so the call is awaited inside a `try` and both count.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCtx } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import { fileStorage } from "@keel/ctx/node";
import fc from "fast-check";
import { afterAll, expect, it } from "vitest";

const SEED = 1337;
const dir = mkdtempSync(join(tmpdir(), "keel-drivers-e1605-"));
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const codeOf = (e: unknown): unknown => (typeof e === "object" && e !== null && "code" in e ? e.code : undefined);

function thrownCode(make: () => unknown): unknown {
  try {
    make();
    return undefined;
  } catch (e) {
    return codeOf(e);
  }
}

async function committedCode(ctx: Ctx, writes: Parameters<Ctx["storage"]["commit"]>[0]): Promise<unknown> {
  try {
    await ctx.storage.commit(writes);
    return undefined;
  } catch (e) {
    return codeOf(e);
  }
}

let n = 0;
const makers: ReadonlyArray<() => Ctx> = [
  () => createCtx({ mode: "sim", seed: SEED }),
  () => createCtx({ mode: "real", drivers: { storage: fileStorage(join(dir, `d${String(n++)}.json`)) } }),
];

const keyArb = fc.string({ maxLength: 4 });
const expectArb = fc.option(fc.string({ maxLength: 4 }), { nil: null });
const valueArb = fc.option(fc.string({ maxLength: 4 }), { nil: undefined });

it.skip("`createCtx({ mode: 'sim', drivers: {} })` throws E1605; a `commit` naming one key twice throws E1606", async () => {
  expect(thrownCode(() => createCtx({ mode: "sim", drivers: {} }))).toBe("E1605");
  expect(thrownCode(() => createCtx({ mode: "sim", seed: SEED, drivers: {} }))).toBe("E1605");

  await fc.assert(
    fc.asyncProperty(keyArb, expectArb, expectArb, valueArb, valueArb, async (key, e1, e2, v1, v2) => {
      for (const make of makers) {
        const ctx = make();
        const w1 = v1 === undefined ? { key, expect: e1 } : { key, expect: e1, value: v1 };
        const w2 = v2 === undefined ? { key, expect: e2 } : { key, expect: e2, value: v2 };
        expect(await committedCode(ctx, [w1, w2])).toBe("E1606");
      }
    }),
    { seed: SEED, numRuns: 50 },
  );
});

it.skip("E1605 `drivers` on a `sim` ctx (throws)", () => {
  const net = {
    fetch: () => Promise.resolve(new Response(null)),
    online: () => true,
  };
  const storage = {
    get: () => Promise.resolve(null),
    set: () => Promise.resolve(),
    read: (keys: readonly string[]) => Promise.resolve(keys.map(() => null)),
    commit: () => Promise.resolve(true),
  };
  const driversArb = fc.constantFrom({}, { storage }, { net }, { storage, net });
  fc.assert(
    fc.property(driversArb, fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }), (drivers, seed) => {
      expect(thrownCode(() => createCtx({ mode: "sim", seed, drivers }))).toBe("E1605");
    }),
    { seed: SEED, numRuns: 25 },
  );
});

it.skip("E1606 one key twice in a `commit` (throws)", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(keyArb, { minLength: 1, maxLength: 5 }), fc.nat(), fc.nat(), async (keys, i, j) => {
      // Distinct keys, then one of them repeated at another position.
      const distinct = [...new Set(keys)];
      const dup = distinct[i % distinct.length] ?? "";
      const names = [...distinct];
      names.splice(j % (names.length + 1), 0, dup);
      for (const make of makers) {
        const ctx = make();
        expect(
          await committedCode(
            ctx,
            names.map((key) => ({ key, expect: null, value: "v" })),
          ),
        ).toBe("E1606");
        // The same keys without the repeat do not throw.
        expect(
          await committedCode(
            ctx,
            distinct.map((key) => ({ key, expect: null })),
          ),
        ).toBeUndefined();
      }
    }),
    { seed: SEED, numRuns: 50 },
  );
});
