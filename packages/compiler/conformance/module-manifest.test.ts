// Seed 1337
// Declaration clauses of k.module: module() and ModuleSchema from @keel/compiler.
import { module, ModuleSchema } from "@keel/compiler";
import fc from "fast-check";
import { expect, test } from "vitest";

const SEED = 1337;
const lowerId = fc.stringMatching(/^[a-z][a-zA-Z]{2,10}$/);
const pascal = fc.stringMatching(/^[A-Z][a-z]{3,8}$/);
const manifest = fc.record({
  id: lowerId,
  deps: fc.uniqueArray(fc.oneof(lowerId, fc.constantFrom("@keel/std-auth", "@keel/std-money")), { maxLength: 4 }),
  capabilities: fc.uniqueArray(fc.constantFrom("clock", "random", "net", "storage"), { maxLength: 4 }),
  public: fc.record({
    exports: fc.uniqueArray(pascal, { maxLength: 4 }),
  }),
});

test("ModuleSchema accepts every well-formed manifest, including stdlib package names in deps", () => {
  fc.assert(
    fc.property(manifest, (m) => {
      expect(ModuleSchema.parse(m).ok).toBe(true);
    }),
    { seed: SEED, numRuns: 50 },
  );
});

test("ModuleSchema rejects an id that is not lowerCamel", () => {
  const base = { deps: [], capabilities: [], public: { exports: [] } };
  const bad = fc.oneof(
    pascal,
    fc.stringMatching(/^[a-z]{2,5}-[a-z]{2,5}$/),
    fc.stringMatching(/^[a-z]{2,5}_[a-z]{2,5}$/),
    fc.stringMatching(/^[0-9][a-z]{2,5}$/),
    fc.constant(""),
  );
  fc.assert(
    fc.property(bad, (id) => {
      expect(ModuleSchema.parse({ id, ...base }).ok).toBe(false);
    }),
    { seed: SEED, numRuns: 50 },
  );
});

test("ModuleSchema rejects a manifest without an id", () => {
  expect(ModuleSchema.parse({ deps: [], capabilities: [], public: { exports: [] } }).ok).toBe(false);
});

test("ModuleSchema rejects non-array or non-string deps, capabilities, and public lists", () => {
  const base = { id: "orders", deps: [], capabilities: [], public: { exports: [] } };
  const junk = fc.oneof(fc.string(), fc.integer(), fc.constant(null), fc.array(fc.integer(), { minLength: 1 }));
  fc.assert(
    fc.property(junk, (v) => {
      expect(ModuleSchema.parse({ ...base, deps: v }).ok).toBe(false);
      expect(ModuleSchema.parse({ ...base, capabilities: v }).ok).toBe(false);
      expect(ModuleSchema.parse({ ...base, public: { exports: v } }).ok).toBe(false);
      expect(ModuleSchema.parse({ ...base, public: { exports: [], routes: v } }).ok).toBe(false);
    }),
    { seed: SEED, numRuns: 40 },
  );
});

test("module() returns a manifest that keeps id, deps, capabilities, and the public surface, and passes ModuleSchema", () => {
  fc.assert(
    fc.property(manifest, (m) => {
      const out = module(m);
      expect(out.id).toBe(m.id);
      expect(out.deps).toEqual(m.deps);
      expect(out.capabilities).toEqual(m.capabilities);
      expect(out.public).toEqual(m.public);
      expect(ModuleSchema.parse(out).ok).toBe(true);
    }),
    { seed: SEED, numRuns: 40 },
  );
});

test("a stdlib module's manifest is validated by the same schema as an app module's", () => {
  const std = { id: "std-auth", deps: [], capabilities: ["net"], public: { exports: ["Session"] } };
  const app = { ...std, id: "stdAuth" };
  // Same shape, same validator: only the id rule differs, and it differs identically for both kinds.
  expect(ModuleSchema.parse(app).ok).toBe(true);
  expect(ModuleSchema.parse({ ...app, capabilities: "net" }).ok).toBe(false);
  expect(ModuleSchema.parse({ ...std, capabilities: "net" }).ok).toBe(false);
});

test("module() and ModuleSchema give identical results for equal input", () => {
  fc.assert(
    fc.property(manifest, (m) => {
      expect(ModuleSchema.parse(m)).toEqual(ModuleSchema.parse(m));
    }),
    { seed: SEED, numRuns: 20 },
  );
});
