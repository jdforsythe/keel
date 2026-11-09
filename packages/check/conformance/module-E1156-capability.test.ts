// Spec: k.module, clause "Using `ctx.net` or calling `observe` in a module whose `capabilities` lack `net` or `observe` reports E1156."
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

const mkObs = (id: string, listed: string[], head: string, call: string) => [
  manifestFile({ id, capabilities: listed }),
  {
    path: `modules/${id}/Watch.ts`,
    source: `${head}\nexport const Watch = (ctx: Ctx) => ${call}\n`,
  },
];
const IMP = "import { observe } from '@keel/ctx'\nimport type { Ctx } from '@keel/ctx'";

test("calling observe in a module whose capabilities lack observe reports E1156 with a fix, and listing observe clears it", () => {
  fc.assert(
    fc.property(lowerId, (id) => {
      const d = codesOf(mkObs(id, ["clock"], IMP, "observe(ctx, (e) => {})"), "E1156");
      expect(d.length).toBeGreaterThanOrEqual(1);
      expect(d[0]?.path).toBe(`modules/${id}/Watch.ts`);
      expect(typeof d[0]?.fix).toBe("string");
      expect(d[0]?.fix).toContain("observe");
      expect(has(mkObs(id, ["observe"], IMP, "observe(ctx, (e) => {})"), "E1156")).toBe(false);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("an observe not imported from @keel/ctx reports nothing", () => {
  fc.assert(
    fc.property(lowerId, (id) => {
      const head = "import type { Ctx } from '@keel/ctx'\nconst observe = (_c: unknown, _f: unknown) => 1";
      expect(has(mkObs(id, ["clock"], head, "observe(ctx, (e) => {})"), "E1156")).toBe(false);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("an observe imported from @keel/ctx under an alias and called reports E1156", () => {
  fc.assert(
    fc.property(lowerId, (id) => {
      const head = "import { observe as watch } from '@keel/ctx'\nimport type { Ctx } from '@keel/ctx'";
      const d = codesOf(mkObs(id, ["clock"], head, "watch(ctx, (e) => {})"), "E1156");
      expect(d.length).toBeGreaterThanOrEqual(1);
      expect(d[0]?.path).toBe(`modules/${id}/Watch.ts`);
    }),
    { seed: SEED, numRuns: 20 },
  );
});
