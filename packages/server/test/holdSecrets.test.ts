// @vitest-environment node
// k.privacy Server log: a request's secret set takes no more values once its written forms are truly past the scrub's
// cap, and every text of the request stays one mark after that. A small cap stands in for 2,000,000 characters.
import { describe, expect, it } from "vitest";
import { automatonOf } from "../src/internal/automatonOf.ts";
import { formsOf } from "../src/internal/formsOf.ts";
import { holdSecrets } from "../src/internal/holdSecrets.ts";
import { scrubbed } from "../src/internal/scrubbed.ts";

const counter = () => ({ build: 0, walk: 0, forms: 0 });
/** The `i`th distinct 30-character value. */
const distinctOf = (i: number): string => `value-${i}-`.padEnd(30, "q");
/** The `i`th case variant of one 30-character value: its folded forms as is are all one. */
const variantOf = (i: number): string =>
  [..."abcdefghijklmnopqrstuvwxyzabcd"].map((c, j) => ((i >> j) & 1 ? c.toUpperCase() : c)).join("");
/** The characters of `v`'s distinct written forms: what a value adds to the set's bound. */
const boundOf = (v: string): number => [...new Set(formsOf(v).map(([f]) => f))].reduce((n, f) => n + f.length, 0);

describe("holdSecrets", () => {
  it("a set whose bound passes the cap while its forms do not keeps every value and marks the last one", () => {
    const values = Array.from({ length: 40 }, (_, i) => variantOf(i));
    const probe = counter();
    expect(automatonOf([new Set(values)], probe, Number.MAX_SAFE_INTEGER)).not.toBe("over");
    // The cap is the forms' true length, which the bound passes: the set is checked, and is not over.
    const cap = probe.forms;
    expect(values.reduce((n, v) => n + boundOf(v), 0)).toBeGreaterThan(cap);
    const into = new Set<string>();
    const count = counter();
    let checks = 0;
    for (const v of values) {
      const before = count.build;
      holdSecrets(into, [v], count, cap);
      if (count.build !== before) checks++;
    }
    // Once as the bound passes the cap; the next check waits for the bound to double.
    expect(checks).toBe(1);
    expect(into.size).toBe(41);
    const last = variantOf(39);
    expect(into.has(last)).toBe(true);
    expect(automatonOf([into], undefined, cap)).not.toBe("over");
    expect(scrubbed(`token ${last} end`, [[into, "[secret]"]])).toBe("token [secret] end");
  });

  it("once the set is over it takes no more values and every way the scrub asks stays over", () => {
    const cap = 2000;
    const into = new Set<string>();
    const pii = new Set<string>(["someone@example.com"]);
    for (let i = 0; i < 200; i++) holdSecrets(into, [distinctOf(i)], undefined, cap);
    const size = into.size;
    expect(size).toBeLessThan(201);
    expect(automatonOf([into], undefined, cap)).toBe("over");
    for (let i = 200; i < 400; i++) {
      holdSecrets(into, [distinctOf(i), String(i)], undefined, cap);
      pii.add(`p${i}`);
      expect(into.size).toBe(size);
      // As the scrub asks (the secrets then the pii values) and as the noter asks (the secrets alone), in turn.
      expect(automatonOf([into, pii], undefined, cap)).toBe("over");
      expect(automatonOf([into], undefined, cap)).toBe("over");
    }
    expect(into.has(distinctOf(399))).toBe(false);
  });

  it("checks the set only when the bound passes the cap and at each doubling, and does no work once over", () => {
    const cap = 2000;
    const into = new Set<string>();
    const count = counter();
    let checks = 0;
    let stopped = -1;
    for (let i = 0; i < 1000; i++) {
      const before = count.build;
      const size = into.size;
      holdSecrets(into, [distinctOf(i)], count, cap);
      if (count.build !== before) checks++;
      if (stopped < 0 && into.size === size) stopped = i;
    }
    expect(stopped).toBeGreaterThan(0);
    expect(checks).toBeLessThanOrEqual(2);
    const after = count.build;
    for (let i = 1000; i < 2000; i++) holdSecrets(into, [distinctOf(i)], count, cap);
    expect(count.build).toBe(after);
  });

  it("adds the empty string with the first value, and with none", () => {
    const into = new Set<string>();
    holdSecrets(into, []);
    expect([...into]).toEqual([""]);
    holdSecrets(into, ["abc", "abc"]);
    expect([...into]).toEqual(["", "abc"]);
  });
});
