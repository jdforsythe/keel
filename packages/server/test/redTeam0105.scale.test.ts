import { fixedTime } from "@keel/tooling/test-time";
// @vitest-environment node
// Red team of the log scrub at scale (k.privacy Server log): values and texts of 80,000 characters and more, 20,000
// values at once, and the property that no value of any text makes the scrub throw or leaves a copy. The small cases
// are in redTeam0105.test.ts. A mutation run leaves these cases out (vitest.stryker.config.mjs). Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { redacted } from "../src/internal/redacted.ts";
import { scrubbed } from "../src/internal/scrubbed.ts";
import { stepBounds } from "./stepBounds.ts";

const SEED = 1337;
// The cases scrub texts of hundreds of thousands of characters and run 300 generated cases; a starved worker needs
// more than the default 5 s.
const SCALE_MS = fixedTime(60_000);

const chars = fc.oneof(
  fc.constantFrom(
    "\ud800",
    "\udbff",
    "\udc00",
    "\udfff",
    "\ud83d",
    "\ude00",
    '"',
    "'",
    "\\",
    "\n",
    "\t",
    "\u0000",
    "\u001f",
    "\u007f",
    "[",
    "]",
    "(",
    ")",
    ".",
    "*",
    "+",
    "?",
    "^",
    "$",
    "{",
    "}",
    "|",
    "/",
    "%",
    "-",
  ),
  fc.integer({ min: 0, max: 0xffff }).map((c) => String.fromCharCode(c)),
  fc.constantFrom("a", "B", "z", "0", "9", "😀", "é", "ß", "σ"),
);
const textOf = (min: number, max: number) => fc.array(chars, { minLength: min, maxLength: max }).map((a) => a.join(""));
const longOr = (t: fc.Arbitrary<string>) =>
  fc.oneof(
    { weight: 4, arbitrary: t },
    { weight: 1, arbitrary: fc.tuple(t, fc.integer({ min: 100, max: 1_500 })).map(([v, n]) => v.repeat(n)) },
  );

describe("no secret or pii value makes the scrub throw", { timeout: SCALE_MS }, () => {
  it("a value longer than one expression holds is marked, and many values do not overflow an expression", () => {
    const long = "k3y-".repeat(20_000);
    expect(scrubbed(`x ${long} y ${long.toUpperCase()}`, [[new Set([long]), "[secret]"]])).toBe(
      "x [secret] y [secret]",
    );
    const many = new Set(Array.from({ length: 20_000 }, (_, i) => `bulk-key-${i}-0f0f0f0f0f0f0f0f`));
    const one = "bulk-key-19999-0f0f0f0f0f0f0f0f";
    expect(scrubbed(`a ${one} b`, [[many, "[secret]"]])).toBe("a [secret] b");
  });

  it("property: the scrub never throws and leaves no copy of a secret or pii value, whatever their text", () => {
    fc.assert(
      fc.property(
        longOr(textOf(3, 12)),
        longOr(textOf(3, 12)),
        textOf(0, 20),
        textOf(0, 20),
        textOf(0, 20),
        (secret, pii, before, between, after) => {
          const message = `${before}${secret}${between}${pii}${between}${secret}${after}`;
          const out = redacted(message, { secrets: new Set([secret]), pii: new Set([pii]) });
          for (const piece of out.split(/\[secret\]|\[pii\]/)) {
            expect(piece.includes(secret)).toBe(false);
            expect(piece.includes(pii)).toBe(false);
          }
          const plain = scrubbed(message, [[new Set([secret]), "[secret]"]]);
          for (const piece of plain.split("[secret]")) expect(piece.includes(secret)).toBe(false);
        },
      ),
      { seed: SEED, numRuns: 300 },
    );
  });
});

describe("a long value is found in steps linear in the text", { timeout: SCALE_MS }, () => {
  // A clock is not read in tests (S0006): each case counts the walk's steps against its derived bound, 5 per unit of
  // each reading of the text, and the build's against its bound from the forms' units, the forms and the trie's nodes
  // (stepBounds.ts), and runs the adversarial shape, which a scan restarted at every position would not finish in the
  // test's time. The sets are larger than a scope may hold, so the matcher is driven directly.
  const scanned = (message: string, secrets: readonly string[]): { out: string; linear: boolean } => {
    const count = { build: 0, walk: 0 };
    const set = new Set(secrets);
    const out = scrubbed(message, [[set, "[secret]"]], count);
    const most = stepBounds(message, [set]);
    const linear = count.walk <= most.walk && count.walk <= 5 * message.length + 5 && count.build <= most.build;
    return { out, linear };
  };

  it("text of 400,000 of one character against a 400,001-character secret that differs in its last character", () => {
    const { out, linear } = scanned(`m ${"a".repeat(400_000)}`, [`${"a".repeat(400_000)}b`]);
    expect(out).toBe(`m ${"a".repeat(400_000)}`);
    expect(linear).toBe(true);
  });

  it("a periodic secret of 400,000 characters against its own text less its last character", () => {
    const { out, linear } = scanned("ab".repeat(200_000).slice(0, -1), ["ab".repeat(200_000)]);
    expect(out).toBe("ab".repeat(200_000).slice(0, -1));
    expect(linear).toBe(true);
  });

  it("50 secrets sharing a 15,000-character prefix, against a text that repeats the prefix", () => {
    const prefix = "k".repeat(15_000);
    const secrets = Array.from({ length: 50 }, (_, i) => `${prefix}-${i}-tail`);
    const { out, linear } = scanned(`${prefix.repeat(10)} ${secrets[7] ?? ""} end`, secrets);
    expect(out).toBe(`${prefix.repeat(10)} [secret] end`);
    expect(linear).toBe(true);
  });
});
