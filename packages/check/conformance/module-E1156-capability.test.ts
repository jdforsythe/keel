// Seed 1337
import fc from "fast-check";
import { expect, test } from "vitest";
import { codesOf, has, lowerId, manifestFile, SEED } from "./module-support.ts";

const USE: Record<string, string> = {
  clock: "ctx.clock.now()",
  random: "ctx.random.float()",
  net: "ctx.net.fetch(r)",
  storage: "ctx.storage.get('k')",
};
const caps = Object.keys(USE);
const capArb = fc.constantFrom(...caps);

const mk = (id: string, cap: string, listed: string[]) => [
  manifestFile({ id, capabilities: listed }),
  {
    path: `modules/${id}/Run.ts`,
    source: `import type { Ctx } from '@keel/ctx'\nexport const Run = (ctx: Ctx, r: Request) => ${USE[cap]}\n`,
  },
];

test("using ctx.net in a module without net in capabilities reports E1156", () => {
  fc.assert(
    fc.property(lowerId, (id) => {
      const d = codesOf(mk(id, "net", ["clock"]), "E1156");
      expect(d.length).toBeGreaterThanOrEqual(1);
      expect(d[0]?.path).toBe(`modules/${id}/Run.ts`);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("E1156: listing the used capability in capabilities clears it", () => {
  fc.assert(
    fc.property(lowerId, capArb, (id, cap) => {
      expect(has(mk(id, cap, [cap]), "E1156")).toBe(false);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("E1156: any capability used but not listed is reported, whichever it is", () => {
  fc.assert(
    fc.property(lowerId, capArb, (id, cap) => {
      expect(
        has(
          mk(
            id,
            cap,
            caps.filter((c) => c !== cap),
          ),
          "E1156",
        ),
      ).toBe(true);
    }),
    { seed: SEED, numRuns: 20 },
  );
});
