// @vitest-environment node
// k.privacy Server log: a scope's secret set holds at most `SECRETS_CAP` distinct non-empty values; the next one puts
// it past the cap, and from then on it takes no more values and every text scrubbed with it is one mark. A small
// `most` stands in for 100,000, so each case stays cheap. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SECRETS_CAP } from "../src/internal/SECRETS_CAP.ts";
import { automatonOf } from "../src/internal/automatonOf.ts";
import { holdSecrets } from "../src/internal/holdSecrets.ts";
import { pastCap } from "../src/internal/pastCap.ts";
import { redacted } from "../src/internal/redacted.ts";
import { scrubbed } from "../src/internal/scrubbed.ts";

const SEED = 1337;
const value = fc.stringMatching(/^[a-z0-9-]{3,12}$/);

describe("the secret set's count cap", () => {
  it("is 100,000 values", () => {
    expect(SECRETS_CAP).toBe(100_000);
  });

  it("holds `most` distinct values and is past the cap at the next one, which it does not keep", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(value, { minLength: 1, maxLength: 60 }),
        fc.integer({ min: 0, max: 60 }),
        (vs, most) => {
          const into = new Set<string>();
          holdSecrets(into, vs, undefined, undefined, most);
          const past = vs.length > most;
          expect(pastCap.has(into)).toBe(past);
          expect(into.size - 1).toBe(past ? most + 1 : vs.length);
          expect(automatonOf([into]) === "over").toBe(past);
        },
      ),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("counts a value made twice once, a number as its `String()`, and a case variant as a value", () => {
    const into = new Set<string>();
    holdSecrets(into, ["abc", "abc", String(42), "42"], undefined, undefined, 3);
    expect(pastCap.has(into)).toBe(false);
    holdSecrets(into, ["ABC"], undefined, undefined, 3);
    expect(pastCap.has(into)).toBe(false);
    holdSecrets(into, ["Abc"], undefined, undefined, 3);
    expect(pastCap.has(into)).toBe(true);
  });

  it("does not count the empty string the set holds", () => {
    const into = new Set<string>();
    holdSecrets(into, ["one", "two"], undefined, undefined, 2);
    expect(into.has("")).toBe(true);
    expect(pastCap.has(into)).toBe(false);
  });

  it("past the cap takes no more values, adds no work, and every text is one mark however it is asked", () => {
    fc.assert(
      fc.property(fc.uniqueArray(value, { minLength: 6, maxLength: 30 }), fc.string(), (vs, text) => {
        const into = new Set<string>();
        const pii = new Set<string>(["someone@example.com"]);
        holdSecrets(into, vs.slice(0, 6), undefined, undefined, 5);
        const size = into.size;
        const count = { build: 0, walk: 0, forms: 0 };
        holdSecrets(into, vs.slice(6), count, undefined, 5);
        expect(into.size).toBe(size);
        expect(count.build).toBe(0);
        expect(automatonOf([into, pii])).toBe("over");
        expect(automatonOf([pii, into])).toBe("over");
        expect(scrubbed(text, [[into, "[secret]"]])).toBe("[secret]");
        expect(redacted(text, { secrets: into, pii })).toBe("[secret]");
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("marks a set past the character cap as past too, so a later value cannot bring a text back", () => {
    const into = new Set<string>();
    const cap = 500;
    for (let i = 0; i < 100 && !pastCap.has(into); i++)
      holdSecrets(into, [`value-${i}-`.padEnd(30, "q")], undefined, cap);
    expect(pastCap.has(into)).toBe(true);
    // The default cap would not be over for these forms; the set stays past whatever cap is asked.
    expect(automatonOf([into])).toBe("over");
    expect(redacted("value-1-qqqqqqqqqqqqqqqqqqqqqq end", { secrets: into, pii: new Set() })).toBe("[secret]");
  });

  it("reaches the real cap with 100,001 one-to-six-digit values quickly", () => {
    const into = new Set<string>();
    const t0 = performance.now();
    holdSecrets(
      into,
      Array.from({ length: 100_001 }, (_, i) => String(i)),
    );
    expect(pastCap.has(into)).toBe(true);
    expect(into.size).toBe(100_002);
    expect(performance.now() - t0).toBeLessThan(5_000);
  });
});
