// Properties for KeelError helpers: s.error, s.result, attempt. fast-check seed 1337 (fixed for determinism).
import fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vitest";
import { gen } from "../src/gen.ts";
import { type KeelError, type Result, attempt, err, ok, s } from "../src/index.ts";

fc.configureGlobal({ seed: 1337, numRuns: 100 });

const Locked = s.error("orders.locked", s.object({ id: s.id("Order"), tries: s.int() }));
const Res = s.result(s.array(s.number()).nullable(), Locked);

describe("s.error", () => {
  it("make builds a value its own schema parses; message defaults to the code", () => {
    fc.assert(
      fc.property(gen(Locked), fc.option(fc.string(), { nil: undefined }), (e, msg) => {
        const made = msg === undefined ? Locked.make(e.data) : Locked.make(e.data, msg);
        expect(made).toEqual({ code: "orders.locked", message: msg ?? "orders.locked", data: e.data });
        expect(Locked.parse(made).ok).toBe(true);
      }),
    );
  });
  it("rejects a different code or bad data", () => {
    fc.assert(
      fc.property(gen(Locked), fc.string(), (e, code) => {
        expect(Locked.parse({ ...e, code }).ok).toBe(code === "orders.locked");
        expect(Locked.parse({ ...e, data: { id: "" } }).ok).toBe(false);
      }),
    );
  });
  it("infers KeelError<code, data>", () => {
    expectTypeOf<s.infer<typeof Locked>>().toEqualTypeOf<
      KeelError<"orders.locked", { id: string & { readonly __brand: "Order" }; tries: number }>
    >();
  });
});

describe("s.result", () => {
  it("gen yields ok and err values that round-trip through JSON", () => {
    fc.assert(
      fc.property(gen(Res), (v) => {
        const back = Res.parse(JSON.parse(JSON.stringify(Res.encode(v))));
        expect(back.ok && JSON.stringify(back.value)).toBe(JSON.stringify(v));
      }),
    );
  });
  it("accepts exactly ok(T) and err(E) shapes", () => {
    fc.assert(
      fc.property(gen(Locked), fc.array(fc.double({ noNaN: true, noDefaultInfinity: true })), (e, xs) => {
        expect(Res.parse(ok(xs)).ok).toBe(true);
        expect(Res.parse(ok(null)).ok).toBe(true);
        expect(Res.parse(err(e)).ok).toBe(true);
        expect(Res.parse(err(xs)).ok).toBe(false);
        expect(Res.parse(ok(e)).ok).toBe(false);
      }),
    );
  });
  it("infers Result<T, E>", () => {
    expectTypeOf<s.infer<typeof Res>>().toEqualTypeOf<Result<number[] | null, s.infer<typeof Locked>>>();
  });
});

describe("attempt", () => {
  it("sync: returns ok(value) synchronously", () => {
    fc.assert(
      fc.property(fc.anything(), (v) => {
        expect(attempt(() => v)).toEqual(ok(v));
      }),
    );
  });
  it("sync: anything thrown becomes keel.unexpected; never throws", () => {
    fc.assert(
      fc.property(fc.anything({ withNullPrototype: true }), (thrown) => {
        const r = attempt((): number => {
          throw thrown;
        });
        expect(r.ok).toBe(false);
        if (!r.ok) {
          expect(r.error.code).toBe("keel.unexpected");
          expect(typeof r.error.data.cause).toBe("string");
          expect(r.error.message.length).toBeLessThan(90);
        }
      }),
    );
  });
  it("async: resolves to ok(value), rejection becomes keel.unexpected; never rejects", async () => {
    await fc.assert(
      fc.asyncProperty(fc.anything(), fc.boolean(), async (v, fail) => {
        const r = await attempt(() => (fail ? Promise.reject(v) : Promise.resolve(v)));
        if (fail) expect(!r.ok && r.error.code).toBe("keel.unexpected");
        else expect(r).toEqual(ok(v));
      }),
    );
  });
  it("Error causes keep name and message", () => {
    const r = attempt(() => {
      throw new TypeError("bad thing");
    });
    expect(!r.ok && r.error.data.cause).toBe("TypeError: bad thing");
  });
});
