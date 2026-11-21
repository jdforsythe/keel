// @vitest-environment node
// The log scrub at scale (k.privacy Server log): texts and values of 400,000 characters and more, and the cap of
// 2,000,000 characters of written forms at its exact size. Steps are counted, no clock is read. The same bounds on
// small texts are in scrubSteps.test.ts. A mutation run leaves these cases out (vitest.stryker.config.mjs).
import { describe, expect, it } from "vitest";
import { scrubbed } from "../src/internal/scrubbed.ts";

const counter = () => ({ build: 0, walk: 0, forms: 0 });
const one = (message: string, secrets: readonly string[], pii: readonly string[] = []): string =>
  scrubbed(message, [
    [new Set(secrets), "[secret]"],
    [new Set(pii), "[pii]"],
  ]);
/** At most this many forms per value: as written, JSON-escaped, URL-encoded, and two base64 forms. */
const FORMS = 5;

describe("linear steps", () => {
  it("the shapes that were quadratic stay within the bounds", () => {
    const shapes: [string, string[]][] = [
      [`m ${"a".repeat(400_000)}`, [`${"a".repeat(400_000)}b`]],
      ["ab".repeat(200_000).slice(0, -1), ["ab".repeat(200_000)]],
      ["a".repeat(400_000), Array.from({ length: 256 }, (_, i) => "a".repeat(999 - i))],
    ];
    for (const [message, secrets] of shapes) {
      const count = counter();
      scrubbed(message, [[new Set(secrets), "[secret]"]], count);
      expect(count.walk).toBeLessThanOrEqual(5 * message.length + 5);
      expect(count.build).toBeLessThanOrEqual(4 * count.forms + 2 * FORMS * secrets.length);
    }
  });
});

describe("exact cap", () => {
  // 857,140 of `k`: as written, and base64 without its two `=` (1,142,854), one form for both alphabets: 1,999,994.
  // `qq` and padded `cXE=` add 6, `qqq` and `cXFx` add 7.
  const big = "k".repeat(857_140);
  it("forms totalling 2,000,000 characters are scrubbed, and one more makes each text one mark", () => {
    const at = counter();
    const set = new Set([big, "qq"]);
    expect(scrubbed("m qq end", [[set, "[secret]"]], at)).toBe("m [secret] end");
    expect(at.forms).toBe(2_000_000);
    const past = counter();
    const over = new Set([big, "qqq"]);
    expect(scrubbed("m qqq end", [[over, "[secret]"]], past)).toBe("[secret]");
    expect(past.forms).toBe(2_000_001);
    expect(scrubbed("at app/routes/x.ts:4", [[over, "[secret]"]])).toBe("[secret]");
    expect(scrubbed("", [[over, "[secret]"]])).toBe("[secret]");
  });

  it("past the cap the mark is the secret's when the request made one, else the pii mark", () => {
    expect(one("hello", [], [big, "qqq"])).toBe("[pii]");
    expect(one("hello", ["s3cret"], [big, "qqq"])).toBe("[secret]");
  });
});

describe("the cases the scan broke on", () => {
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

  it("50 secrets sharing a 15,000-character prefix are marked exactly, and with a 20,000 prefix the text is one mark", () => {
    const shared = (n: number): { message: string; secrets: string[] } => {
      const p = "k".repeat(n);
      const secrets = Array.from({ length: 50 }, (_, i) => `${p}-${i}-tail`);
      return { message: `${p.repeat(10)} ${secrets[7] ?? ""} end`, secrets };
    };
    const under = shared(15_000);
    expect(one(under.message, under.secrets)).toBe(`${"k".repeat(15_000).repeat(10)} [secret] end`);
    const over = shared(20_000);
    expect(one(over.message, over.secrets)).toBe("[secret]");
  });
});

describe("the cap bounds the work", () => {
  // Values of 400 characters: about 2,100 pass the cap with their base64 forms, and 9,000 make at most about 8,400,000
  // characters of forms where nothing stops at the cap.
  const users = (n: number): Set<string> =>
    new Set(Array.from({ length: n }, (_, i) => `user${String(i).padStart(6, "0")}${"x".repeat(390)}`));
  const sets = (pii: ReadonlySet<string>): [ReadonlySet<string>, string][] => [
    [new Set<string>(), "[secret]"],
    [pii, "[pii]"],
  ];

  it("forming stops at the cap, so 9,000 values of 400 characters cost what 3,000 do", () => {
    const few = counter();
    const many = counter();
    expect(scrubbed("login failed for user7@example.com", sets(users(3_000)), few)).toBe("[pii]");
    expect(scrubbed("login failed for user7@example.com", sets(users(9_000)), many)).toBe("[pii]");
    expect(many.build).toBe(few.build);
    expect(many.forms).toBe(few.forms);
    expect(many.forms).toBeGreaterThan(2_000_000);
    expect(many.forms).toBeLessThanOrEqual(2_000_000 + 2_000);
  });

  it("a later text on the same sets, grown or not, adds no build and no forms", () => {
    const pii = users(3_000);
    const passes = sets(pii);
    scrubbed("first", passes);
    const later = counter();
    expect(scrubbed("frame /app/x.ts:1:1", passes, later)).toBe("[pii]");
    pii.add("one-more@example.com");
    expect(scrubbed("frame /app/x.ts:2:1", passes, later)).toBe("[pii]");
    expect(later).toEqual(counter());
  });

  it("past the cap a request that made a secret holding no string or number is marked `[secret]`", () => {
    expect(
      scrubbed("refused true", [
        [new Set([""]), "[secret]"],
        [users(3_000), "[pii]"],
      ]),
    ).toBe("[secret]");
  });
});
