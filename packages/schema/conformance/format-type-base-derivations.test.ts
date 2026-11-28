// k.formats, clause "`encode` and JSON Schema are `base`'s (JSON Schema adds `format: name`); `decodeStrings` coerces as `base` does and then parses the format, so a value `check` refuses is a `format` issue; `doc()` is `name`; `gen` maps `gen(from)` through `map`, keeping values `parse` accepts." (rfc:0079)
// Seed 1337. JSON Schema: untestable from the public API (no derivation is exported by `@keel/schema`).
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
const fixture = () => {
  const Even = mkEven();
  return { Even, Form: s.object({ n: Even, tag: s.string() }) };
};

describe("k.schema format types: derivations", () => {
  test("`encode` is `base`'s: a format value encodes as the value `base` encodes", () => {
    const { Even, Form } = fixture();
    fc.assert(
      fc.property(gen(Even), (v) => {
        expect(Even.encode(v)).toEqual(s.int().encode(v));
      }),
      opts,
    );
  });

  test("`decodeStrings` is `base`'s: a numeric string decodes as the int `base` decodes, then `check` applies", () => {
    const { Even, Form } = fixture();
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 1000 }), (n) => {
        const r = Form.decodeStrings(new URLSearchParams({ n: String(n), tag: "t" }));
        expect(r.ok).toBe(n % 2 === 0);
        if (r.ok) expect(r.value.n).toBe(n);
        else expect(r.error.data.issues).toEqual([{ path: ["n"], rule: "format" }]);
      }),
      opts,
    );
  });

  test("`gen` maps `gen(from)` through `map`, keeping values `parse` accepts", () => {
    const { Even, Form } = fixture();
    fc.assert(
      fc.property(gen(Even), (v) => {
        expect(v % 2 === 0).toBe(true);
        expect(Even.parse(v).ok).toBe(true);
      }),
      opts,
    );
  });

  test("`doc()` is `name`", () => {
    const { Even, Form } = fixture();
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z][a-z0-9.-]{0,11}$/), (name) => {
        const F = s.format(name, s.string(), { check: () => true, gen: { from: s.string(), map: (x) => x } });
        expect(F.doc()).toBe(name);
      }),
      opts,
    );
  });
});
