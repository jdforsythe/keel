// Spec: k.attempt, clause "With `S = s.object({ n: s.int() })`: `S.parseJson('{"n":1}')` is `ok({ n: 1 })`, `S.parseJson('{')` is `err` `schema.invalid` whose one issue is `{ path: [], rule: 'json' }`, `S.parseJson('{"n":"x"}')` is `err` with the issues `S.parse({ n: 'x' })` gives, and none of them throws."
// Seed 1337.
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED } from "./fixtures";

const opts = { seed: SEED, numRuns: RUNS };
const S = s.object({ n: s.int() });

describe("k.attempt: parseJson", () => {
  it("S.parseJson('{\"n\":1}') is ok({ n: 1 })", () => {
    expect(S.parseJson('{"n":1}')).toEqual({ ok: true, value: { n: 1 } });
  });

  it("S.parseJson('{') is err schema.invalid whose one issue is { path: [], rule: 'json' }", () => {
    const r = S.parseJson("{");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("schema.invalid");
    expect(r.error.data.issues).toEqual([{ path: [], rule: "json" }]);
  });

  it("S.parseJson('{\"n\":\"x\"}') is err with the issues S.parse({ n: 'x' }) gives", () => {
    const a = S.parseJson('{"n":"x"}');
    const b = S.parse({ n: "x" });
    expect(a.ok).toBe(false);
    expect(b.ok).toBe(false);
    if (a.ok || b.ok) return;
    expect(a.error.data.issues).toEqual(b.error.data.issues);
  });

  it("property: for any text, S.parseJson does not throw and agrees with S.parse of the parsed text", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.json(),
          fc.jsonValue().map((v) => JSON.stringify(v)),
        ),
        (text) => {
          const r = S.parseJson(text);
          let parsed: unknown;
          let valid = true;
          try {
            parsed = JSON.parse(text);
          } catch {
            valid = false;
          }
          if (!valid) {
            expect(r.ok).toBe(false);
            if (!r.ok) expect(r.error.data.issues).toEqual([{ path: [], rule: "json" }]);
            return;
          }
          expect(r).toEqual(S.parse(parsed));
        },
      ),
      opts,
    );
  });

  it("s.json.parseJson takes any JSON text", () => {
    fc.assert(
      fc.property(fc.jsonValue(), (v) => {
        expect(s.json.parseJson(JSON.stringify(v))).toEqual({ ok: true, value: JSON.parse(JSON.stringify(v)) });
      }),
      opts,
    );
  });
});
