// @vitest-environment node
// The log scrub at scale (k.privacy Cost): texts of 400,000 characters and more, matchers built for sets larger than a
// scope may hold, and the cap of 65,536 bytes of a scope's distinct values at its exact size. Steps are counted, no
// clock is read. The same bounds on small texts are in scrubSteps.test.ts. A mutation run leaves these cases out
// (vitest.stryker.config.mjs).
import { describe, expect, it } from "vitest";
import { SCRUB_CAP } from "../src/internal/SCRUB_CAP.ts";
import { holdSecrets } from "../src/internal/holdSecrets.ts";
import { holdValues } from "../src/internal/holdValues.ts";
import { pastCap } from "../src/internal/pastCap.ts";
import { scrubbed } from "../src/internal/scrubbed.ts";
import { tallyOf } from "../src/internal/tallyOf.ts";
import { stepBounds } from "./stepBounds.ts";

// Each case builds a matcher of up to 8,000,000 form units or scrubs a text of 400,000 characters or more; a starved
// worker needs more than the default 5 s.
const SCALE_MS = 60_000;
const counter = () => ({ build: 0, walk: 0 });
const one = (message: string, secrets: readonly string[], pii: readonly string[] = []): string =>
  scrubbed(message, [
    [new Set(secrets), "[secret]"],
    [new Set(pii), "[pii]"],
  ]);
/** A request's two sets, sharing one count as `createApp` joins them. */
const scope = (): { secrets: Set<string>; pii: Set<string> } => {
  const secrets = new Set<string>();
  const pii = new Set<string>();
  tallyOf(pii, secrets);
  return { secrets, pii };
};
const passes = (rq: { secrets: Set<string>; pii: Set<string> }): [ReadonlySet<string>, string][] => [
  [rq.secrets, "[secret]"],
  [rq.pii, "[pii]"],
];

describe("linear steps", { timeout: SCALE_MS }, () => {
  it("the shapes that were quadratic stay within the bounds, on sets past what a scope may hold", () => {
    const shapes: [string, string[]][] = [
      [`m ${"a".repeat(400_000)}`, [`${"a".repeat(400_000)}b`]],
      ["ab".repeat(200_000).slice(0, -1), ["ab".repeat(200_000)]],
      ["a".repeat(400_000), Array.from({ length: 256 }, (_, i) => "a".repeat(999 - i))],
    ];
    for (const [message, secrets] of shapes) {
      const count = counter();
      const set = new Set(secrets);
      scrubbed(message, [[set, "[secret]"]], count);
      const most = stepBounds(message, [set]);
      expect(count.walk).toBeLessThanOrEqual(most.walk);
      expect(count.walk).toBeLessThanOrEqual(5 * message.length + 5);
      expect(count.build).toBeLessThanOrEqual(most.build);
    }
  });

  it("a secret of 65,536 bytes, at the cap, against a 400,000 run it differs from in its last character", () => {
    const rq = scope();
    holdSecrets(rq.secrets, [`${"a".repeat(65_535)}b`]);
    expect(pastCap.has(rq.secrets)).toBe(false);
    const message = `m ${"a".repeat(400_000)}`;
    const count = counter();
    expect(scrubbed(message, passes(rq), count)).toBe(message);
    const most = stepBounds(message, [rq.secrets, rq.pii]);
    expect(count.walk).toBeLessThanOrEqual(most.walk);
    expect(count.build).toBeLessThanOrEqual(most.build);
  });
});

describe("exact cap", { timeout: SCALE_MS }, () => {
  // 65,534 of `k` and `qq`: 65,536 bytes, the cap. `qqq` instead: 65,537.
  const big = "k".repeat(65_534);
  it("values totalling 65,536 bytes are scrubbed, and one more byte makes each text one mark", () => {
    expect(SCRUB_CAP).toBe(65_536);
    const at = scope();
    holdSecrets(at.secrets, [big, "qq"]);
    expect(tallyOf(at.secrets).bytes).toBe(65_536);
    expect(scrubbed("m qq end", passes(at))).toBe("m [secret] end");
    const past = scope();
    holdSecrets(past.secrets, [big, "qqq"]);
    expect(tallyOf(past.secrets).bytes).toBe(65_537);
    expect(scrubbed("m qqq end", passes(past))).toBe("[secret]");
    expect(scrubbed("at app/routes/x.ts:4", passes(past))).toBe("[secret]");
    expect(scrubbed("", passes(past))).toBe("[secret]");
  });

  it("8,192 values of 8 ASCII bytes are at the cap and 8,193 past; 4,096 and 4,097 of 8 Cyrillic letters alike", () => {
    const ascii = (i: number): string => `v${String(i).padStart(7, "0")}`;
    const cyr = (i: number): string =>
      Array.from({ length: 8 }, (_, j) => String.fromCharCode(0x430 + (Math.floor(i / 9 ** j) % 9))).join("");
    for (const [of, n] of [
      [ascii, 8_192],
      [cyr, 4_096],
    ] as const) {
      const at = scope();
      holdSecrets(
        at.secrets,
        Array.from({ length: n }, (_, i) => of(i)),
      );
      expect(tallyOf(at.secrets).bytes).toBe(65_536);
      expect(scrubbed(`bad ${of(7)}`, passes(at))).toBe("bad [secret]");
      const past = scope();
      holdSecrets(
        past.secrets,
        Array.from({ length: n + 1 }, (_, i) => of(i)),
      );
      expect(pastCap.has(past.secrets)).toBe(true);
      expect(scrubbed(`bad ${of(7)}`, passes(past))).toBe("[secret]");
    }
  });

  it("past the cap the mark is the secret's when the request made one, else the pii mark, the two sets on one count", () => {
    const pii = scope();
    holdValues(pii.pii, [big, "qqq"]);
    expect(scrubbed("hello", passes(pii))).toBe("[pii]");
    expect(pastCap.has(pii.secrets)).toBe(true);
    // A 6-byte secret and 65,530 bytes of pii are at the cap together; one more pii byte puts both sets past.
    const both = scope();
    holdSecrets(both.secrets, ["s3cret"]);
    holdValues(both.pii, ["k".repeat(65_530)]);
    expect(scrubbed("m s3cret end", passes(both))).toBe("m [secret] end");
    holdValues(both.pii, ["q"]);
    expect(scrubbed("hello", passes(both))).toBe("[secret]");
  });
});

describe("the cases the scan broke on", { timeout: SCALE_MS }, () => {
  it("a 400,000 run against a 400,001-character secret that differs in its last character is unchanged", () => {
    expect(one(`m ${"a".repeat(400_000)}`, [`${"a".repeat(400_000)}b`])).toBe(`m ${"a".repeat(400_000)}`);
  });

  it("a periodic 400,000-character secret against its text less one character is unchanged", () => {
    const message = "ab".repeat(200_000).slice(0, -1);
    expect(one(message, ["ab".repeat(200_000)])).toBe(message);
  });

  it("500 secrets of 1,000 `a` and nine digits leave a 520,000 run of `a` unchanged", () => {
    const secrets = Array.from({ length: 500 }, (_, i) => `${"a".repeat(1_000)}${String(i).padStart(9, "0")}`);
    expect(one("a".repeat(520_000), secrets)).toBe("a".repeat(520_000));
  });

  it("256 secrets of 999 down to 744 `a` mark a 400,000 run of `a` whole", () => {
    const secrets = Array.from({ length: 256 }, (_, i) => "a".repeat(999 - i));
    expect(one("a".repeat(400_000), secrets)).toBe("[secret]");
  });

  it("50 secrets sharing a 1,302-character prefix are marked exactly, and with a 1,303 prefix the text is one mark", () => {
    // 50 × the prefix, plus `-i-tail` of 7 bytes for i under 10 and 8 for the rest (390): 65,490 bytes at 1,302,
    // 65,540 at 1,303.
    const shared = (n: number): { message: string; rq: { secrets: Set<string>; pii: Set<string> } } => {
      const p = "k".repeat(n);
      const secrets = Array.from({ length: 50 }, (_, i) => `${p}-${i}-tail`);
      const rq = scope();
      holdSecrets(rq.secrets, secrets);
      return { message: `${p.repeat(300)} ${secrets[7] ?? ""} end`, rq };
    };
    const under = shared(1_302);
    expect(tallyOf(under.rq.secrets).bytes).toBe(65_490);
    expect(scrubbed(under.message, passes(under.rq))).toBe(`${"k".repeat(1_302 * 300)} [secret] end`);
    const over = shared(1_303);
    expect(tallyOf(over.rq.secrets).bytes).toBe(65_540);
    expect(scrubbed(over.message, passes(over.rq))).toBe("[secret]");
  });

  it("50 secrets sharing a 15,000-character prefix, a set no scope may hold, are marked exactly within the bounds", () => {
    const p = "k".repeat(15_000);
    const set = new Set(Array.from({ length: 50 }, (_, i) => `${p}-${i}-tail`));
    const message = `${p.repeat(10)} ${p}-7-tail end`;
    const count = counter();
    expect(scrubbed(message, [[set, "[secret]"]], count)).toBe(`${p.repeat(10)} [secret] end`);
    const most = stepBounds(message, [set]);
    expect(count.walk).toBeLessThanOrEqual(most.walk);
    expect(count.build).toBeLessThanOrEqual(most.build);
  });
});

describe("the cap bounds the work", { timeout: SCALE_MS }, () => {
  // Values of 400 bytes: 163 are 65,200 bytes, and the 164th passes the cap. Values past it are not taken.
  const users = (n: number): string[] =>
    Array.from({ length: n }, (_, i) => `user${String(i).padStart(6, "0")}${"x".repeat(390)}`);
  const held = (n: number): { secrets: Set<string>; pii: Set<string> } => {
    const rq = scope();
    holdValues(rq.pii, users(n));
    return rq;
  };

  it("the set stops at the value that passes the cap, so 9,000 values of 400 bytes cost what 3,000 do", () => {
    const few = held(3_000);
    const many = held(9_000);
    expect(few.pii.size).toBe(164);
    expect(many.pii.size).toBe(164);
    expect(tallyOf(few.pii).bytes).toBe(65_600);
    expect(tallyOf(many.pii).bytes).toBe(65_600);
    const a = counter();
    const b = counter();
    expect(scrubbed("login failed for user7@example.com", passes(few), a)).toBe("[pii]");
    expect(scrubbed("login failed for user7@example.com", passes(many), b)).toBe("[pii]");
    expect(a).toEqual(counter());
    expect(b).toEqual(counter());
  });

  it("a later text on the same sets, grown or not, adds no build and no walk", () => {
    const rq = held(3_000);
    scrubbed("first", passes(rq));
    const later = counter();
    expect(scrubbed("frame /app/x.ts:1:1", passes(rq), later)).toBe("[pii]");
    rq.pii.add("one-more@example.com");
    expect(scrubbed("frame /app/x.ts:2:1", passes(rq), later)).toBe("[pii]");
    expect(later).toEqual(counter());
  });

  it("past the cap a request that made a secret holding no string or number is marked `[secret]`", () => {
    const rq = scope();
    holdSecrets(rq.secrets, []);
    holdValues(rq.pii, users(3_000));
    expect(scrubbed("refused true", passes(rq))).toBe("[secret]");
  });
});
