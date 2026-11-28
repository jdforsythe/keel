// @vitest-environment happy-dom
// k.privacy, Sinks "Limits, not marked: a copy under three or more escapings; an escape the views do not read (`\x41`, octal, `\U`, `%u`, another named HTML entity, a numeric one without its `;`); a copy part NFC and part NFD, and compatibility forms (NFKC, NFKD, full-width letters); hex of a value under 8 bytes; base64 of a value under 8 bytes inside a longer encoding, unless its own padded encoding stands whole there; a value holding an escape of one family under two escapings of two different families, one of which leaves that escape as is (`a"b%41` JSON-escaped, then URL-encoded); hex or base64 of a text in which the value is itself escaped (base64 of JSON that writes it with `\"`, `\\` or `\u`); base64 with line breaks; hex of UTF-16 and any other encoding, a hash, compression or encryption; a copy cut short, split by other text or with a character changed; a value revealed outside every scope."
// Spec: k.privacy, clause "A revealed secret `a b/c?d&e` thrown as `encodeURIComponent` applied three times logs as thrown."
// Seed: 1337.
// The stated limit is asserted as the spec states it: three escapings are not read, so the thrown text is logged as thrown. One and two escapings of the same secret are marked, which shows the limit is the third.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { afterPrefix, modes, thrower } from "./privacy-scrub-support.ts";

const SEED = 1337;
const times = (v: string, n: number): string => (n === 0 ? v : times(encodeURIComponent(v), n - 1));

const UNREAD: ReadonlyArray<readonly [string, string, string]> = [
  ["an escape `\\x41`", "abcdefgh", "\\x61\\x62\\x63\\x64\\x65\\x66\\x67\\x68"],
  ["an octal escape", "abcdefgh", "\\141\\142\\143\\144\\145\\146\\147\\150"],
  [
    "a `\\U` escape",
    "abcdefgh",
    "\\U00000061\\U00000062\\U00000063\\U00000064\\U00000065\\U00000066\\U00000067\\U00000068",
  ],
  ["a `%u` escape", "abcdefgh", "%u0061%u0062%u0063%u0064%u0065%u0066%u0067%u0068"],
  ["a numeric entity without its `;`", "abcdefgh", "&#97&#98&#99&#100&#101&#102&#103&#104"],
  ["compatibility forms (full-width letters)", "abcdefgh", "\uff41\uff42\uff43\uff44\uff45\uff46\uff47\uff48"],
  ["a copy part NFC and part NFD", "\u00e9\u00e9\u00e9\u00e9", "\u00e9\u00e9\u0065\u0301\u0065\u0301"],
  ["hex of a value under 8 bytes", "abcdefg", "61626364656667"],
  ["base64 of a value under 8 bytes inside a longer encoding", "abcdefg", "YWJjZGVmZ1hZWg=="],
  ["a copy cut short", "abcdefgh", "abcdefg"],
  ["a copy split by other text", "abcdefgh", "abcd efgh"],
  ["a copy with a character changed", "abcdefgh", "abcdefgX"],
];

for (const mode of modes) {
  describe(`k.privacy Limits, in ${mode}`, () => {
    it("A revealed secret `a b/c?d&e` thrown as `encodeURIComponent` applied three times logs as thrown.", async () => {
      const t = await thrower(mode);
      const thrown = times("a b/c?d&e", 3);
      const out = await t.run("a b/c?d&e", thrown);
      expect(out.messages).toHaveLength(1);
      expect(afterPrefix(out.messages[0] ?? "")).toBe(thrown);
      expect(out.frames.join("\n")).not.toContain("[secret]");
      expect(out.path).toBe("/a");
    });

    it("The same secret thrown as `encodeURIComponent` applied once and twice is marked: the limit starts at the third escaping.", async () => {
      const t = await thrower(mode);
      for (const n of [1, 2]) {
        const out = await t.run("a b/c?d&e", `x ${times("a b/c?d&e", n)} y`);
        expect(afterPrefix(out.messages[0] ?? "")).toBe("x [secret] y");
      }
    });

    it("Limits, not marked: a value holding an escape of one family under two escapings of two different families, one of which leaves that escape as is (`a\"b%41` JSON-escaped, then URL-encoded) logs as thrown; if the scrub comes to find it, the spec's limit is out of date.", async () => {
      const t = await thrower(mode);
      const v = 'a"b%41';
      const json = JSON.stringify(v).slice(1, -1);
      expect(json).toBe('a\\"b%41');
      const thrown = encodeURIComponent(json);
      expect(thrown).toBe("a%5C%22b%2541");
      const out = await t.run(v, `x ${thrown} y`);
      expect(afterPrefix(out.messages[0] ?? "")).toBe(`x ${thrown} y`);
    });

    for (const [what, v, thrown] of UNREAD)
      it(`Limits, not marked: ${what} logs as thrown.`, async () => {
        const t = await thrower(mode);
        const out = await t.run(v, `x ${thrown} y`);
        expect(afterPrefix(out.messages[0] ?? "")).toBe(`x ${thrown} y`);
      });

    it("For every generated secret of 8 or more bytes that `encodeURIComponent` changes at each of its three applications, the thrice-applied text logs as thrown, and once and twice are marked.", async () => {
      const t = await thrower(mode);
      const withUnsafe = fc
        .tuple(
          fc.stringMatching(/^[a-z0-9]{3,8}$/),
          fc.constantFrom(" ", "/", "?", "&", "=", "#", "é", "€", "😀"),
          fc.stringMatching(/^[a-z0-9]{3,8}$/),
        )
        .map(([a, m, b]) => `${a}${m}${b}`);
      await fc.assert(
        fc.asyncProperty(withUnsafe, async (v) => {
          fc.pre(new TextEncoder().encode(v).length >= 8);
          const thrice = times(v, 3);
          const out = await t.run(v, thrice);
          expect(out.messages).toHaveLength(1);
          expect(afterPrefix(out.messages[0] ?? "")).toBe(thrice);
          for (const n of [1, 2]) {
            const marked = await t.run(v, times(v, n));
            expect(afterPrefix(marked.messages[0] ?? "")).toBe("[secret]");
          }
        }),
        { seed: SEED, numRuns: 40 },
      );
    });
  });
}
