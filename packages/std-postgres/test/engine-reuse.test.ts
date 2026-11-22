// std.postgres Modes: one engine per URL per process, across evaluations of the module (a `keel dev` reload evaluates
// it again), so a reload opens no second pool or PGlite folder.
import fc from "fast-check";
import { expect, test, vi } from "vitest";

const fresh = async (): Promise<typeof import("../src/server/internal/engineFor.ts")> => {
  vi.resetModules();
  return import("../src/server/internal/engineFor.ts");
};

test("a fresh evaluation of engineFor answers the engine the last one opened for a URL", async () => {
  const urls = ["postgres://u:p@127.0.0.1:1/reuse_a", "postgresql://u:p@127.0.0.1:1/reuse_b"];
  const first = await fresh();
  const made = urls.map((u) => first.engineFor(u));
  const second = await fresh();
  expect(second.engineFor).not.toBe(first.engineFor);
  urls.forEach((u, i) => expect(second.engineFor(u)).toBe(made[i]));
});

test("over any order of evaluations and URLs, each URL keeps the engine it was first given", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.tuple(fc.boolean(), fc.integer({ min: 0, max: 3 })), { maxLength: 12 }),
      async (steps) => {
        let mod = await fresh();
        const seen = new Map<string, unknown>();
        for (const [reload, n] of steps) {
          if (reload) mod = await fresh();
          const url = `postgres://u:p@127.0.0.1:1/reuse_p${n}`;
          const engine = mod.engineFor(url);
          if (!seen.has(url)) seen.set(url, engine);
          expect(engine).toBe(seen.get(url));
        }
      },
    ),
    { seed: 1337, numRuns: 20 },
  );
});
