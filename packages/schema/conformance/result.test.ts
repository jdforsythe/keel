import { type KeelError, err, ok, s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
// Spec: k.errors, clause "`ok(v)` is `{ ok: true, value: v }`; `err(e)` is `{ ok: false, error: e }`."
// Spec: k.errors, clause "`s.result(T, E)` round-trips every generated ok and err value through its JSON codec."
// Seed 1337.
import { describe, expect, it } from "vitest";
import { RUNS, SEED } from "./fixtures";

const OrderId = s.id("Order");
const OrderLocked = s.error("orders.locked", s.object({ id: OrderId }));
const Res = s.result(s.string(), OrderLocked);
const keelError: fc.Arbitrary<KeelError<string, unknown>> = fc.record({
  code: fc.string(),
  message: fc.string(),
  data: fc.jsonValue(),
});
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
      fc.property(keelError, (e) => {
        expect(err(e)).toEqual({ ok: false, error: e });
      }),
      opts,
    );
  });
});

describe("k.errors: s.result round-trip", () => {
  it("s.result(T, E) round-trips generated ok and err values through encode/parse", () => {
    fc.assert(
      fc.property(gen(Res), (v) => {
        const d = Res.parse(JSON.parse(JSON.stringify(Res.encode(v))));
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
        const d = Res.parse(JSON.parse(JSON.stringify(Res.encode(v))));
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
        const d = Res.parse(JSON.parse(JSON.stringify(Res.encode(v))));
        expect(d.ok).toBe(true);
        if (d.ok) expect(d.value).toEqual(v);
      }),
      opts,
    );
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
