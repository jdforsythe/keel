// @vitest-environment node
// k.privacy Cost: a scope counts the UTF-8 bytes of its distinct values, secret and `.pii()` together, a value's NFC
// and NFD counted where they differ; the value that passes 65,536 bytes puts every set of the scope past the cap, and
// from then on the sets take no more values and every text scrubbed with them is one mark. A small cap stands in for
// 65,536 bytes where a case would otherwise be large. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SCRUB_CAP } from "../src/internal/SCRUB_CAP.ts";
import { automatonOf } from "../src/internal/automatonOf.ts";
import { holdSecrets } from "../src/internal/holdSecrets.ts";
import { holdValues } from "../src/internal/holdValues.ts";
import { pastCap } from "../src/internal/pastCap.ts";
import { redacted } from "../src/internal/redacted.ts";
import { scrubbed } from "../src/internal/scrubbed.ts";
import { tallyOf } from "../src/internal/tallyOf.ts";

const SEED = 1337;
const value = fc.stringMatching(/^[a-z0-9-]{3,12}$/);
/** A request's two sets, sharing one count as `createApp` joins them. */
const scope = (): { secrets: Set<string>; pii: Set<string> } => {
  const secrets = new Set<string>();
  const pii = new Set<string>();
  tallyOf(pii, secrets);
  return { secrets, pii };
};

describe("the scope's byte cap", () => {
  it("is 65,536 bytes", () => {
    expect(SCRUB_CAP).toBe(65_536);
  });

  it("property: holds values while their bytes are at most the cap, and is past at the one that passes it, which it keeps", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(value, { minLength: 1, maxLength: 60 }),
        fc.integer({ min: 0, max: 400 }),
        (vs, cap) => {
          const into = new Set<string>();
          holdSecrets(into, vs, cap);
          let bytes = 0;
          let kept = vs.length;
          for (let i = 0; i < vs.length; i++) {
            bytes += (vs[i] ?? "").length;
            if (bytes > cap) {
              kept = i + 1;
              break;
            }
          }
          const past = bytes > cap;
          expect(pastCap.has(into)).toBe(past);
          expect(into.size - 1).toBe(kept);
          expect(tallyOf(into).bytes).toBe(bytes);
          expect(automatonOf([into]) === "over").toBe(past);
        },
      ),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("counts a value made twice once, a number as its `String()`, and a case variant as a value", () => {
    const into = new Set<string>();
    holdSecrets(into, ["abc", "abc", String(42), "42"], 8);
    expect(tallyOf(into).bytes).toBe(5);
    holdSecrets(into, ["ABC"], 8);
    expect(pastCap.has(into)).toBe(false);
    expect(tallyOf(into).bytes).toBe(8);
    holdSecrets(into, ["Abc"], 8);
    expect(pastCap.has(into)).toBe(true);
  });

  it("counts a value's NFC and NFD where they differ, a form already counted once, a lone surrogate as 3 and a pair as 4", () => {
    const into = new Set<string>();
    // `café` precomposed is 5 bytes and its NFD 6: 11.
    holdSecrets(into, ["café"], 11);
    expect(tallyOf(into).bytes).toBe(11);
    // Its NFD as a value of its own is held and adds no bytes.
    holdSecrets(into, ["café"], 11);
    expect(into.has("café")).toBe(true);
    expect(tallyOf(into).bytes).toBe(11);
    expect(pastCap.has(into)).toBe(false);
    const units = new Set<string>();
    holdSecrets(units, ["\ud800", "😀"], 7);
    expect(tallyOf(units).bytes).toBe(7);
    expect(pastCap.has(units)).toBe(false);
    holdSecrets(units, ["é"], 7);
    // `é` is 2 bytes and its NFD 3.
    expect(tallyOf(units).bytes).toBe(12);
    expect(pastCap.has(units)).toBe(true);
  });

  it("does not count the empty string the set holds", () => {
    const into = new Set<string>();
    holdSecrets(into, ["one", "two"], 6);
    expect(into.has("")).toBe(true);
    expect(tallyOf(into).bytes).toBe(6);
    expect(pastCap.has(into)).toBe(false);
  });

  it("counts a request's secret and pii values on one count, a value in both once, and puts both sets past", () => {
    const rq = scope();
    holdSecrets(rq.secrets, ["abcd"], 10);
    holdValues(rq.pii, ["abcd", "efgh"], 10);
    expect(tallyOf(rq.pii).bytes).toBe(8);
    expect(pastCap.has(rq.secrets) || pastCap.has(rq.pii)).toBe(false);
    holdValues(rq.pii, ["ijk"], 10);
    expect(pastCap.has(rq.secrets)).toBe(true);
    expect(pastCap.has(rq.pii)).toBe(true);
    holdSecrets(rq.secrets, ["later"], 10);
    expect(rq.secrets.has("later")).toBe(false);
    expect(redacted("abcd x", rq)).toBe("[secret]");
    // Sets of two scopes count apart.
    const other = scope();
    holdValues(other.pii, ["abcd", "efgh"], 10);
    expect(pastCap.has(other.pii)).toBe(false);
  });

  it("past the cap takes no more values, adds no work, and every text is one mark however it is asked", () => {
    fc.assert(
      fc.property(fc.uniqueArray(value, { minLength: 6, maxLength: 30 }), fc.string(), (vs, text) => {
        const into = new Set<string>();
        const pii = new Set<string>(["someone@example.com"]);
        const cap = vs.slice(0, 5).reduce((n, v) => n + v.length, 0);
        holdSecrets(into, vs.slice(0, 5), cap);
        expect(pastCap.has(into)).toBe(false);
        holdSecrets(into, vs.slice(5, 6), cap);
        expect(pastCap.has(into)).toBe(true);
        const size = into.size;
        const bytes = tallyOf(into).bytes;
        holdSecrets(into, vs.slice(6), cap);
        expect(into.size).toBe(size);
        expect(tallyOf(into).bytes).toBe(bytes);
        const count = { build: 0, walk: 0 };
        expect(automatonOf([into, pii], count)).toBe("over");
        expect(automatonOf([pii, into], count)).toBe("over");
        expect(scrubbed(text, [[into, "[secret]"]], count)).toBe("[secret]");
        expect(count).toEqual({ build: 0, walk: 0 });
        expect(redacted(text, { secrets: into, pii })).toBe("[secret]");
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("keeps a set past a small cap past, so a later value or the default cap cannot bring a text back", () => {
    const into = new Set<string>();
    const cap = 500;
    for (let i = 0; i < 100 && !pastCap.has(into); i++) holdSecrets(into, [`value-${i}-`.padEnd(30, "q")], cap);
    expect(pastCap.has(into)).toBe(true);
    // 16 values of 30 bytes are 480; the 17th passes 500.
    expect(into.size).toBe(18);
    holdSecrets(into, ["more"]);
    expect(into.has("more")).toBe(false);
    expect(automatonOf([into])).toBe("over");
    expect(redacted("value-1-qqqqqqqqqqqqqqqqqqqqqq end", { secrets: into, pii: new Set() })).toBe("[secret]");
  });

  it("reaches the real cap with 8,193 distinct 8-byte values, and holds 8,192 below it", () => {
    const of = (n: number): string[] => Array.from({ length: n }, (_, i) => `s${String(i).padStart(7, "0")}`);
    const at = new Set<string>();
    holdSecrets(at, of(8_192));
    expect(pastCap.has(at)).toBe(false);
    expect(tallyOf(at).bytes).toBe(65_536);
    const past = new Set<string>();
    holdSecrets(past, of(8_193));
    expect(pastCap.has(past)).toBe(true);
    expect(past.size).toBe(8_194);
  });
});
