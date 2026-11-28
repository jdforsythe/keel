// defect, isDefect and attempt's expect (k.errors Defects): a defect never reaches `expect` at any depth of nesting,
// and what `expect` does not recognize goes on as the very value. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type KeelError, attempt, defect, err, isDefect, ok } from "../src/index.ts";

const opts = { seed: 1337, numRuns: 100 };
type Seen = KeelError<"t.seen", number>;
const seen = (n: number): Seen => ({ code: "t.seen", message: "t.seen", data: n });

/** Run `fn` under `depth` nested `attempt(..., expect)` calls, each counting the values it is handed. */
const nested = (fn: () => unknown, depth: number, calls: { n: number }, recognize: (x: unknown) => boolean) => {
  let run: () => unknown = fn;
  for (let i = 0; i < depth; i++) {
    const inner = run;
    run = () => {
      const r = attempt(inner, (x) => {
        calls.n++;
        return recognize(x) ? seen(i) : undefined;
      });
      return r.ok ? r.value : defect(`layer ${i} got ${r.error.code}`);
    };
  }
  return run;
};

describe("defect", () => {
  it("passes through any number of nested expects unchanged, and none of them is called", () => {
    fc.assert(
      fc.property(fc.string(), fc.integer({ min: 1, max: 6 }), fc.boolean(), (m, depth, coded) => {
        const calls = { n: 0 };
        const thrown = coded ? () => defect(m, { code: "E2801" }) : () => defect(m);
        const run = nested(thrown, depth, calls, () => true);
        let out: unknown;
        try {
          run();
        } catch (e) {
          out = e;
        }
        expect(isDefect(out)).toBe(true);
        expect(isDefect(out, "E2801")).toBe(coded);
        expect(out instanceof Error && out.message).toBe(coded ? `E2801 ${m}` : m);
        expect(calls.n).toBe(0);
      }),
      opts,
    );
  });

  it("is a throw: attempt passes it on, even to an expect that claims everything", () => {
    fc.assert(
      fc.property(fc.string(), (m) => {
        let out: unknown;
        try {
          attempt(
            () => defect(m),
            (x) => (x === undefined ? undefined : seen(0)),
          );
        } catch (e) {
          out = e;
        }
        expect(isDefect(out)).toBe(true);
        expect(out instanceof Error && out.message).toBe(m);
      }),
      opts,
    );
  });

  it("carries its code as a non-enumerable own property only, so JSON and spread never see it", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1000, max: 9999 }), (n) => {
        const code: `E${number}` = `E${n}`;
        let v: unknown;
        try {
          defect("x", { code });
        } catch (e) {
          v = e;
        }
        expect(isDefect(v, code)).toBe(true);
        expect(JSON.stringify(v)).toBe("{}");
        expect(typeof v === "object" && v !== null ? { ...v } : null).toEqual({});
      }),
      opts,
    );
  });
});

describe("attempt(fn, expect)", () => {
  it("goes on with the very value when no layer recognizes it, and turns it into the innermost err when one does", () => {
    fc.assert(
      fc.property(fc.anything(), fc.integer({ min: 1, max: 5 }), fc.boolean(), (x, depth, known) => {
        const calls = { n: 0 };
        const run = nested(
          () => {
            throw x;
          },
          depth,
          calls,
          () => known,
        );
        let out: unknown;
        let threw = false;
        try {
          run();
        } catch (e) {
          threw = true;
          out = e;
        }
        expect(threw).toBe(true);
        if (known) {
          // The innermost layer recognizes it and raises a defect on the err; no layer above is handed that defect.
          expect(calls.n).toBe(1);
          expect(isDefect(out)).toBe(true);
          expect(out instanceof Error && out.message).toBe("layer 0 got t.seen");
        } else {
          expect(Object.is(out, x)).toBe(true);
          expect(calls.n).toBe(depth);
        }
      }),
      opts,
    );
  });

  it("returns ok of the value, sync and async, and never calls expect", async () => {
    await fc.assert(
      fc.asyncProperty(fc.jsonValue(), async (v) => {
        let calls = 0;
        const spy = (): Seen | undefined => {
          calls++;
          return seen(0);
        };
        expect(attempt(() => v, spy)).toEqual(ok(v));
        await expect(attempt(async () => v, spy)).resolves.toEqual(ok(v));
        expect(calls).toBe(0);
      }),
      opts,
    );
  });

  it("rejects an async defect unchanged and resolves a recognized rejection to err", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), fc.integer(), async (m, n) => {
        const d = await attempt(
          async () => defect(m),
          () => seen(n),
        ).then(
          () => undefined,
          (e: unknown) => e,
        );
        expect(isDefect(d)).toBe(true);
        await expect(
          attempt(
            async () => Promise.reject(n),
            (x) => (x === n ? seen(n) : undefined),
          ),
        ).resolves.toEqual(err(seen(n)));
      }),
      opts,
    );
  });
});
