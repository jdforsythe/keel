// Clause: optional and nullable are distinct (E1102 reasoning). Seed 1337.
import { describe, expect, expectTypeOf, it } from "vitest";
import fc from "fast-check";
import { s } from "@keel/schema";
import { RUNS, SEED } from "./fixtures";

const Opt = s.object({ a: s.string().optional() });
const Nul = s.object({ a: s.string().nullable() });
const Both = s.object({ a: s.string().optional().nullable() });

describe("k.schema optional vs nullable", () => {
  it("optional: absent key passes", () => expect(Opt.parse({}).ok).toBe(true));
  it("optional: present value passes", () => expect(Opt.parse({ a: "x" }).ok).toBe(true));
  it("optional: null fails", () => {
    const r = Opt.parse({ a: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.data.issues[0]?.rule).toBe("optional-null");
  });
  it("nullable: null passes", () => expect(Nul.parse({ a: null }).ok).toBe(true));
  it("nullable: present value passes", () => expect(Nul.parse({ a: "x" }).ok).toBe(true));
  it("nullable: absent key fails", () => {
    const r = Nul.parse({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.data.issues[0]?.rule).toBe("nullable-absent");
  });
  it("optional+nullable: absent passes", () => expect(Both.parse({}).ok).toBe(true));
  it("optional+nullable: null passes", () => expect(Both.parse({ a: null }).ok).toBe(true));
  it("optional+nullable: value passes", () => expect(Both.parse({ a: "x" }).ok).toBe(true));
  it("optional+nullable: wrong type fails", () => expect(Both.parse({ a: 1 }).ok).toBe(false));

  it("encode keeps absent key absent for optional", () => {
    const e = Opt.encode({});
    expect(typeof e === "object" && e !== null && "a" in e).toBe(false);
  });
  it("encode keeps null as null for nullable", () => {
    expect(Nul.encode({ a: null })).toEqual({ a: null });
  });
  it("decode does not turn null into absent or absent into null", () => {
    const o = Opt.decode({});
    const n = Nul.decode({ a: null });
    expect(o.ok && "a" in o.value).toBe(false);
    expect(n.ok && n.value.a).toBeNull();
  });

  it("types: optional infers an optional key without null", () => {
    type T = s.infer<typeof Opt>;
    expectTypeOf<T>().toEqualTypeOf<{ a?: string }>();
  });
  it("types: nullable infers a required key with null", () => {
    type T = s.infer<typeof Nul>;
    expectTypeOf<T>().toEqualTypeOf<{ a: string | null }>();
  });
  it("types: optional and nullable infer differently", () => {
    expectTypeOf<s.infer<typeof Opt>>().not.toEqualTypeOf<s.infer<typeof Nul>>();
  });

  it("gen() for optional never yields null", () => {
    fc.assert(
      fc.property(Opt.gen(), (v) => v.a !== null),
      { seed: SEED, numRuns: RUNS },
    );
  });
  it("gen() for nullable always has the key", () => {
    fc.assert(
      fc.property(Nul.gen(), (v) => "a" in v),
      { seed: SEED, numRuns: RUNS },
    );
  });
});
