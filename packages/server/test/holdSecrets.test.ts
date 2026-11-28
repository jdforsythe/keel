// @vitest-environment node
// k.privacy Cost: a scope's secret set takes no more values once the UTF-8 bytes of the scope's distinct values pass
// the scrub's cap, read as each value arrives and with no matcher built, and every text of the scope stays one mark
// after that. A small cap stands in for 65,536 bytes.
import { describe, expect, it } from "vitest";
import { automatonOf } from "../src/internal/automatonOf.ts";
import { holdSecrets } from "../src/internal/holdSecrets.ts";
import { pastCap } from "../src/internal/pastCap.ts";
import { scrubbed } from "../src/internal/scrubbed.ts";
import { tallyOf } from "../src/internal/tallyOf.ts";

const counter = () => ({ build: 0, walk: 0 });
/** The `i`th distinct 30-character ASCII value: 30 bytes. */
const distinctOf = (i: number): string => `value-${i}-`.padEnd(30, "q");
/** The `i`th case variant of one 30-character value: distinct values whose folded forms are all one. */
const variantOf = (i: number): string =>
  [..."abcdefghijklmnopqrstuvwxyzabcd"].map((c, j) => ((i >> j) & 1 ? c.toUpperCase() : c)).join("");

describe("holdSecrets", () => {
  it("counts each case variant as a value: at the cap it keeps them all, one byte under it marks with the last one kept", () => {
    const values = Array.from({ length: 40 }, (_, i) => variantOf(i));
    // 40 distinct values of 30 bytes: 1,200 bytes, though their folded forms are those of one value.
    const at = new Set<string>();
    holdSecrets(at, values, 1_200);
    expect(pastCap.has(at)).toBe(false);
    expect(at.size).toBe(41);
    expect(tallyOf(at).bytes).toBe(1_200);
    const last = variantOf(39);
    expect(scrubbed(`token ${last} end`, [[at, "[secret]"]])).toBe("token [secret] end");
    const past = new Set<string>();
    holdSecrets(past, values, 1_199);
    expect(pastCap.has(past)).toBe(true);
    // The value that passes the cap is kept, and the text is one mark.
    expect(past.size).toBe(41);
    expect(past.has(last)).toBe(true);
    expect(scrubbed(`token ${last} end`, [[past, "[secret]"]])).toBe("[secret]");
  });

  it("once the set is over it takes no more values and every way the scrub asks stays over", () => {
    const cap = 2_000;
    const into = new Set<string>();
    const pii = new Set<string>(["someone@example.com"]);
    for (let i = 0; i < 200; i++) holdSecrets(into, [distinctOf(i)], cap);
    // 66 values are 1,980 bytes; the 67th passes 2,000 and is kept: the empty string and 67 values.
    const size = into.size;
    expect(size).toBe(68);
    expect(into.has(distinctOf(66))).toBe(true);
    expect(into.has(distinctOf(67))).toBe(false);
    expect(automatonOf([into])).toBe("over");
    for (let i = 200; i < 400; i++) {
      holdSecrets(into, [distinctOf(i), String(i)], cap);
      pii.add(`p${i}`);
      expect(into.size).toBe(size);
      // As the scrub asks (the secrets then the pii values) and as the noter asks (the secrets alone), in turn.
      expect(automatonOf([into, pii])).toBe("over");
      expect(automatonOf([into])).toBe("over");
    }
    expect(into.has(distinctOf(399))).toBe(false);
  });

  it("counts bytes as values arrive, builds no matcher to learn the cap, and does no work once over", () => {
    const cap = 2_000;
    const into = new Set<string>();
    let stopped = -1;
    for (let i = 0; i < 1_000; i++) {
      const size = into.size;
      holdSecrets(into, [distinctOf(i)], cap);
      if (stopped < 0 && into.size === size) stopped = i;
      if (stopped < 0) expect(tallyOf(into).bytes).toBe(30 * (i + 1));
    }
    expect(stopped).toBe(67);
    const bytes = tallyOf(into).bytes;
    expect(bytes).toBe(2_010);
    for (let i = 1_000; i < 2_000; i++) holdSecrets(into, [distinctOf(i)], cap);
    expect(tallyOf(into).bytes).toBe(bytes);
    expect(tallyOf(into).counted.size).toBe(67);
    // Below the cap no matcher was built while values arrived: the first ask builds one, the next is the cache.
    const below = new Set<string>();
    holdSecrets(
      below,
      Array.from({ length: 60 }, (_, i) => distinctOf(i)),
      cap,
    );
    expect(pastCap.has(below)).toBe(false);
    const first = counter();
    expect(automatonOf([below], first)).not.toBe("over");
    expect(first.build).toBeGreaterThan(0);
    const again = counter();
    automatonOf([below], again);
    expect(again).toEqual(counter());
  });

  it("adds the empty string with the first value, and with none, and counts it as no bytes", () => {
    const into = new Set<string>();
    holdSecrets(into, [], 0);
    expect([...into]).toEqual([""]);
    expect(pastCap.has(into)).toBe(false);
    holdSecrets(into, ["abc", "abc"]);
    expect([...into]).toEqual(["", "abc"]);
    expect(tallyOf(into).bytes).toBe(3);
  });
});
