import { attempt, err, ok, s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
// Clauses: k.errors Conformance sentences owned by @keel/schema. Seed 1337.
import { describe, expect, it } from "vitest";
import { RUNS, SEED } from "./fixtures";

const OrderId = s.id("Order");
const OrderLocked = s.error("orders.locked", s.object({ id: OrderId }));
const Res = s.result(s.string(), OrderLocked);
const opts = { seed: SEED, numRuns: RUNS };

describe("k.errors: ok and err", () => {
  it("ok(v) is { ok: true, value: v }", () => {
    fc.assert(
      fc.property(fc.jsonValue(), (v) => {
        expect(ok(v)).toEqual({ ok: true, value: v });
      }),
      opts,
    );
  });

  it("err(e) is { ok: false, error: e }", () => {
    fc.assert(
      fc.property(fc.jsonValue(), (e) => {
        expect(err(e)).toEqual({ ok: false, error: e });
      }),
      opts,
    );
  });
});

describe("k.errors: s.result round-trip", () => {
  it("s.result(T, E) round-trips generated ok and err values through encode/decode", () => {
    fc.assert(
      fc.property(gen(Res), (v) => {
        const d = Res.decode(JSON.parse(JSON.stringify(Res.encode(v))));
        expect(d.ok).toBe(true);
        if (d.ok) expect(d.value).toEqual(v);
      }),
      opts,
    );
  });

  it("s.result(T, E) round-trips an ok value", () => {
    fc.assert(
      fc.property(fc.string(), (str) => {
        const v = ok(str);
        const d = Res.decode(JSON.parse(JSON.stringify(Res.encode(v))));
        expect(d.ok).toBe(true);
        if (d.ok) expect(d.value).toEqual(v);
      }),
      opts,
    );
  });

  it("s.result(T, E) round-trips an err value built with make", () => {
    fc.assert(
      fc.property(gen(OrderId), (id) => {
        const v = err(OrderLocked.make({ id }));
        const d = Res.decode(JSON.parse(JSON.stringify(Res.encode(v))));
        expect(d.ok).toBe(true);
        if (d.ok) expect(d.value).toEqual(v);
      }),
      opts,
    );
  });
});

describe("k.errors: attempt", () => {
  it("attempt returns ok(value) when fn returns", async () => {
    expect(await attempt(() => 42)).toEqual({ ok: true, value: 42 });
  });

  it("attempt returns ok(value) when fn's promise resolves", async () => {
    expect(await attempt(() => Promise.resolve("v"))).toEqual({ ok: true, value: "v" });
  });

  it("attempt returns err keel.unexpected when fn throws, and never throws", async () => {
    const r = await attempt(() => {
      throw new Error("boom");
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("keel.unexpected");
  });

  it("attempt returns err keel.unexpected when fn throws a non-Error value", async () => {
    await fc.assert(
      fc.asyncProperty(fc.jsonValue(), async (thrown) => {
        const r = await attempt(() => {
          throw thrown;
        });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error.code).toBe("keel.unexpected");
      }),
      opts,
    );
  });

  it("attempt returns err keel.unexpected when fn's promise rejects, and never throws", async () => {
    const r = await attempt(() => Promise.reject(new Error("boom")));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("keel.unexpected");
  });

  it("attempt returns err keel.unexpected for an async function that throws", async () => {
    const r = await attempt(async () => {
      throw new Error("boom");
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("keel.unexpected");
  });
});

describe("k.errors: s.error", () => {
  it("make(data) yields { code, message: code, data }", () => {
    fc.assert(
      fc.property(gen(OrderId), (id) => {
        expect(OrderLocked.make({ id })).toEqual({
          code: "orders.locked",
          message: "orders.locked",
          data: { id },
        });
      }),
      opts,
    );
  });

  it("make(data, 'msg') sets message", () => {
    fc.assert(
      fc.property(gen(OrderId), fc.string({ minLength: 1 }), (id, msg) => {
        expect(OrderLocked.make({ id }, msg)).toEqual({
          code: "orders.locked",
          message: msg,
          data: { id },
        });
      }),
      opts,
    );
  });

  it("the declared error schema parses its own made value", () => {
    fc.assert(
      fc.property(gen(OrderId), (id) => {
        expect(OrderLocked.parse(OrderLocked.make({ id })).ok).toBe(true);
        expect(OrderLocked.parse(OrderLocked.make({ id }, "custom")).ok).toBe(true);
      }),
      opts,
    );
  });
});
