// Spec: k.formats, clause "For a fixture format type, every generated value parses and round-trips; a value `base` accepts and `check` refuses fails with rule `format` at its path; `doc()` is its name; JSON Schema adds `format`; `s.format` in an app file is E1106." (rfc:0079)
// Seed 1337. The JSON Schema half and the E1106 half are placed in other files (see the notes below).
import { s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;
const opts = { seed: SEED, numRuns: 100 };

const mkEven = () =>
  s.format("even", s.int(), {
    check: (v) => v % 2 === 0,
    gen: { from: s.int({ min: -1000, max: 1000 }), map: (n) => n * 2 },
  });
const mkHolder = (even: ReturnType<typeof mkEven>) => s.object({ items: s.array(s.object({ n: even })) });

describe("k.schema format types", () => {
  // Built inside the tests: the module must load before s.format exists.
  const fixture = () => {
    const Even = mkEven();
    return { Even, Holder: mkHolder(Even) };
  };
  test("For a fixture format type, every generated value parses and round-trips", () => {
    const { Even, Holder } = fixture();
    fc.assert(
      fc.property(gen(Even), (v) => {
        const direct = Even.parse(v);
        expect(direct.ok).toBe(true);
        const again = Even.parse(Even.encode(v));
        expect(again.ok).toBe(true);
        if (again.ok) expect(again.value).toBe(v);
      }),
      opts,
    );
    fc.assert(
      fc.property(gen(Holder), (v) => {
        const r = Holder.parse(JSON.parse(JSON.stringify(Holder.encode(v))));
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.value).toEqual(v);
      }),
      opts,
    );
  });

  test("a value `base` accepts and `check` refuses fails with rule `format` at its path", () => {
    const { Even, Holder } = fixture();
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 1000 }), (n) => {
        const odd = n * 2 + 1;
        const top = Even.parse(odd);
        expect(top.ok).toBe(false);
        if (!top.ok) expect(top.error.data.issues).toEqual([{ path: [], rule: "format" }]);
        const nested = Holder.parse({ items: [{ n: 2 }, { n: odd }] });
        expect(nested.ok).toBe(false);
        if (!nested.ok) expect(nested.error.data.issues).toEqual([{ path: ["items", 1, "n"], rule: "format" }]);
      }),
      opts,
    );
  });

  test("`doc()` is its name", () => {
    const { Even, Holder } = fixture();
    expect(Even.doc()).toBe("even");
    expect(Holder.doc()).toContain("even");
  });

  // Untestable from the public API: JSON Schema adds `format: name`. No JSON Schema derivation is exported by `@keel/schema` or named by the spec section; the cli and compiler packages assert it where they derive it.
  // Untestable in this package: `s.format` in an app file is E1106; asserted in packages/check/conformance/E1106-format-in-app.test.ts.
});
