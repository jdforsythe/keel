// @vitest-environment happy-dom
// Spec: k.privacy, Sinks "Copies: a value is marked wherever one of its forms stands in the text or in one of the text's two decoded views (Views). Its forms: the value as given, and its NFC and its NFD where they differ; from 8 bytes of UTF-8, the hex of those bytes; and base64 of them (Base64). A value with a lone surrogate has no hex or base64 form. Letter case folds one code unit at a time, in hex and base64 too, so a near copy may be over-marked. A form under 3 units is marked only as a whole token: no letter, digit, mark or `_` beside it in the view it was found in. Copies that overlap in the text are one mark over all of them, `[secret]` if any is a secret's."
// Spec: k.privacy, Sinks "Views: the decoded view of a text reads it once from the start, writing for each escape what it stands for and any other unit as is: a run of `%` and two hex digits (either case) as bytes, each well-formed UTF-8 sequence among them as its code point and any other byte as its three characters; `+` as a space, or in the second decoded view as `+`; `\u` and four hex digits as that unit; `\"`, `\\`, `\/`, `\b`, `\f`, `\n`, `\r` and `\t` as their characters; `&amp;`, `&lt;`, `&gt;`, `&quot;` and `&apos;`, `&#` with 1 to 7 decimal digits and `;`, and `&#x` or `&#X` with 1 to 6 hex digits and `;`, as their character, a numeric one only for a code point up to U+10FFFF that is no surrogate. The text is read as is, as each of its two decoded views, as each of the two decoded views of each of those, and as a view of each family of escapes alone, any other unit as is, and as that family's view of that view: the `%` escapes with `+` (as a space, and as `+`), the backslash escapes, the entities. A copy found in a view marks the text it was decoded from, from the first character of the escape its first unit came from to the last character of the escape its last unit came from. So a copy under one or two escapings of these kinds, nested in any order, is found: URL-encoded by any encoder that writes `%` escapes, form-encoded, JSON-escaped with or without `\u` or `\/`, HTML-safe JSON, HTML entities, JSON in a URL; a `+` of the value is found whether an escaping wrote it as `%2B` or left it as is (`encodeURI`, JSON, HTML entities); and a value holding an escape of one family is found under one or two escapings of another family that leave it as is (`JSON.stringify` of `a"b%41`, once or twice; `encodeURI` of `x&amp;y z`)."
// Spec: k.privacy, Sinks "Base64: in the standard and the URL-safe alphabet. A value under 8 bytes is matched as its own padded encoding, whole. A value of 8 bytes or more is matched at each of the three byte alignments, alone or inside any longer encoding, as the characters whose six bits all come from its bytes; the mark takes in the character before and the character after that hold some of its bits, at that alignment, and the `=` padding after them. So a base64url JWT payload whose JSON holds the value as is holds a copy."
// Spec: k.privacy, Conformance "For every generated secret of 8 or more UTF-8 bytes with no lone surrogate, each encoding E of it below, and texts p and q of 0 to 20 ASCII letters, digits and spaces that hold no form of it, an action that reveals it and throws an `Error` whose message is p, E, q logs a `diag` whose message ends with a prefix of p, then `[secret]`, then a suffix of q. E is: the value; its NFC; its NFD; `encodeURIComponent` of it, once and twice; `encodeURI` of it; it form-encoded (`URLSearchParams`); `encodeURIComponent` of it with `!`, `'`, `(`, `)` and `*` as `%21`, `%27`, `%28`, `%29` and `%2A`; its `JSON.stringify` less the quotes, as is, with `\u` and four lowercase hex digits for each non-ASCII unit, with `\/` for each `/`, and with `<`, `>`, `&` and `'` as `\u003c`, `\u003e`, `\u0026` and `\u0027`; that first JSON escaping applied twice; it with `&`, `<`, `>`, `"` and `'` as `&amp;`, `&lt;`, `&gt;`, `&quot;` and `&#39;`; it with each code point as `&#<decimal>;`, and as `&#x<hex>;`; `encodeURIComponent` of its `JSON.stringify` less the quotes; the hex of its UTF-8, in lower and in upper case; its base64 and base64url, padded and unpadded."
// Spec: k.privacy, Conformance "For every generated secret of 8 to 40 UTF-8 bytes with no lone surrogate and byte strings a and b of 0 to 5 bytes each, an action that reveals it and throws an `Error` whose message is the base64 or base64url, padded or unpadded, of a, its bytes and b logs a `diag` whose message ends with a prefix of that encoding's characters before index ⌊4·|a|/3⌋, then `[secret]`, then a suffix of its characters after index ⌈4·(|a|+n)/3⌉ − 1 (n the secret's byte count) that starts with no `=`."
// Seed: 1337.
// An action reveals a generated secret and throws a message holding one of its forms between texts p and q; the logged `diag` message is read after the server's own prefix.
// A secret holding `+` is generated for every encoding: Views reads `+` as a space and, in the second decoded view, as `+`, so a `+` written as is or as `%2B` is found.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  ENCODINGS,
  ESCAPERS,
  b64Of,
  hexOf,
  holdsHeadMarkTail,
  modes,
  thrower,
  utf8,
  afterPrefix,
} from "./privacy-scrub-support.ts";

const SEED = 1337;

const META = [..."%+&;#<>\"'\\/ .:=?@!*()~_-\u0000\u0001\n\r\t\u007f "];
const cp = (n: number): string => String.fromCodePoint(n);
const unit: fc.Arbitrary<string> = fc.oneof(
  { weight: 3, arbitrary: fc.constantFrom(...META) },
  { weight: 3, arbitrary: fc.integer({ min: 0x20, max: 0x7e }).map(cp) },
  { weight: 2, arbitrary: fc.integer({ min: 0x80, max: 0x7ff }).map(cp) },
  { weight: 2, arbitrary: fc.integer({ min: 0x800, max: 0xd7ff }).map(cp) },
  { weight: 1, arbitrary: fc.integer({ min: 0xe000, max: 0xfffd }).map(cp) },
  { weight: 2, arbitrary: fc.integer({ min: 0x10000, max: 0x10ffff }).map(cp) },
);
/** A secret of 8 to 40 UTF-8 bytes, no lone surrogate, over every byte class and the characters encodings treat. */
const secret = (min: number, max: number): fc.Arbitrary<string> =>
  fc
    .array(unit, { minLength: 2, maxLength: 20 })
    .map((a) => a.join(""))
    .filter((v) => utf8(v).length >= min && utf8(v).length <= max);
const text = fc.stringMatching(/^[A-Za-z0-9 ]{0,20}$/);

const holdsAForm = (t: string, v: string): boolean => {
  const low = t.toLowerCase();
  return ENCODINGS.some(([, f]) => low.includes(f(v).toLowerCase()));
};

for (const mode of modes) {
  describe(`k.privacy Copies, Views and Base64, in ${mode}`, () => {
    it("For every generated secret of 8 or more UTF-8 bytes with no lone surrogate, each encoding E of it below, and texts p and q of 0 to 20 ASCII letters, digits and spaces that hold no form of it, an action that reveals it and throws an `Error` whose message is p, E, q logs a `diag` whose message ends with a head of p, then `[secret]`, then a tail of q.", async () => {
      const t = await thrower(mode);
      await fc.assert(
        fc.asyncProperty(
          secret(8, 200),
          text,
          text,
          fc.integer({ min: 0, max: ENCODINGS.length - 1 }),
          async (v, p, q, which) => {
            const entry = ENCODINGS[which];
            if (entry === undefined) throw new Error("fixture: no encoding");
            const [name, encode] = entry;
            fc.pre(!holdsAForm(p, v) && !holdsAForm(q, v));
            const e = encode(v);
            const out = await t.run(v, `${p}${e}${q}`);
            expect(out.messages).toHaveLength(1);
            const message = out.messages[0] ?? "";
            expect(holdsHeadMarkTail(message, p, q), `${name}: ${JSON.stringify(message)}`).toBe(true);
            expect(afterPrefix(message)).not.toContain(e);
          },
        ),
        { seed: SEED, numRuns: 150 },
      );
    });

    it("A copy under two escapings of the kinds Views reads, nested in any order, is found: every ordered pair of the escapings, and the scrubbed message holds neither the text nor either decoded view of it.", async () => {
      const t = await thrower(mode);
      await fc.assert(
        fc.asyncProperty(
          secret(8, 60),
          text,
          text,
          fc.integer({ min: 0, max: ESCAPERS.length - 1 }),
          fc.integer({ min: 0, max: ESCAPERS.length - 1 }),
          async (v, p, q, i, j) => {
            const first = ESCAPERS[i];
            const second = ESCAPERS[j];
            if (first === undefined || second === undefined) throw new Error("fixture: no escaper");
            fc.pre(!holdsAForm(p, v) && !holdsAForm(q, v));
            const e = second[1](first[1](v));
            const out = await t.run(v, `${p}${e}${q}`);
            expect(out.messages).toHaveLength(1);
            const message = out.messages[0] ?? "";
            expect(holdsHeadMarkTail(message, p, q), `${first[0]} then ${second[0]}: ${JSON.stringify(message)}`).toBe(
              true,
            );
          },
        ),
        { seed: SEED, numRuns: 150 },
      );
    });

    it("A copy is marked at every offset among text that looks like an encoding: the encodings of the bullet inside fragments of unfinished escapes (`%4`, `&#x`, `\\u00`, `+`), the copy kept apart by a space.", async () => {
      const t = await thrower(mode);
      const fragment = fc.constantFrom(
        "%",
        "%4",
        "%E2%82",
        "+",
        "&",
        "&amp",
        "&#",
        "&#x",
        "&#233",
        ";",
        "\\u00",
        "\\u",
        "%u",
        '"',
        "<",
        "AAAA",
        "YWJj",
      );
      const around = fc.array(fragment, { minLength: 0, maxLength: 8 }).map((a) => a.join(" "));
      await fc.assert(
        fc.asyncProperty(
          secret(8, 60),
          around,
          around,
          fc.integer({ min: 0, max: ENCODINGS.length - 1 }),
          async (v, left, right, which) => {
            const entry = ENCODINGS[which];
            if (entry === undefined) throw new Error("fixture: no encoding");
            const [name, encode] = entry;
            fc.pre(!holdsAForm(left, v) && !holdsAForm(right, v));
            const p = left === "" ? "" : `${left} `;
            const q = right === "" ? "" : ` ${right}`;
            const out = await t.run(v, `${p}${encode(v)}${q}`);
            expect(out.messages).toHaveLength(1);
            const message = out.messages[0] ?? "";
            expect(holdsHeadMarkTail(message, p, q), `${name}: ${JSON.stringify(message)}`).toBe(true);
          },
        ),
        { seed: SEED, numRuns: 150 },
      );
    });

    it("For every generated secret of 8 to 40 UTF-8 bytes with no lone surrogate and byte strings a and b of 0 to 5 bytes each, an action that reveals it and throws an `Error` whose message is the base64 or base64url, padded or unpadded, of a, its bytes and b logs a `diag` whose message ends with a prefix of that encoding's characters before index ⌊4·|a|/3⌋, then `[secret]`, then a suffix of its characters after index ⌈4·(|a|+n)/3⌉ − 1 (n the secret's byte count) that starts with no `=`.", async () => {
      const t = await thrower(mode);
      await fc.assert(
        fc.asyncProperty(
          secret(8, 40),
          fc.uint8Array({ minLength: 0, maxLength: 5 }),
          fc.uint8Array({ minLength: 0, maxLength: 5 }),
          fc.integer({ min: 0, max: 3 }),
          async (v, a, b, which) => {
            const bytes = utf8(v);
            const whole = new Uint8Array([...a, ...bytes, ...b]);
            const std = b64Of(whole);
            const url = std.replaceAll("+", "-").replaceAll("/", "_");
            const e = [std, std.replace(/=+$/, ""), url, url.replace(/=+$/, "")][which] ?? std;
            const first = Math.floor((4 * a.length) / 3);
            const last = Math.ceil((4 * (a.length + bytes.length)) / 3) - 1;
            const out = await t.run(v, e);
            expect(out.messages).toHaveLength(1);
            const rest = afterPrefix(out.messages[0] ?? "");
            const at = rest.indexOf("[secret]");
            expect(at, rest).toBeGreaterThanOrEqual(0);
            expect(rest.indexOf("[secret]", at + 1)).toBe(-1);
            const head = rest.slice(0, at);
            const tail = rest.slice(at + "[secret]".length);
            expect(e.slice(0, first).startsWith(head), `head ${head} of ${e.slice(0, first)}`).toBe(true);
            expect(e.slice(last + 1).endsWith(tail), `tail ${tail} of ${e.slice(last + 1)}`).toBe(true);
            expect(tail.startsWith("=")).toBe(false);
          },
        ),
        { seed: SEED, numRuns: 150 },
      );
    });

    it("A value of 8 bytes or more is matched at each of the three byte alignments, alone or inside any longer encoding: filler bytes 0, 1 and 2 before it each log one `[secret]` and no character of the value's own base64 core.", async () => {
      const t = await thrower(mode);
      await fc.assert(
        fc.asyncProperty(
          secret(8, 40),
          fc.integer({ min: 0, max: 2 }),
          fc.uint8Array({ minLength: 0, maxLength: 9 }),
          async (v, k, after) => {
            const bytes = utf8(v);
            const e = b64Of(new Uint8Array([...new Array<number>(k).fill(0x41), ...bytes, ...after])).replace(
              /=+$/,
              "",
            );
            const out = await t.run(v, `jwt=${e} end`);
            expect(out.messages).toHaveLength(1);
            const rest = afterPrefix(out.messages[0] ?? "");
            expect(rest).toContain("[secret]");
            expect(rest.startsWith("jwt=")).toBe(true);
            expect(rest.endsWith(" end")).toBe(true);
            const core = b64Of(new Uint8Array([...new Array<number>(k).fill(0x41), ...bytes])).slice(
              Math.ceil((8 * k) / 6),
              Math.floor((8 * (k + bytes.length)) / 6),
            );
            expect(rest).not.toContain(core);
          },
        ),
        { seed: SEED, numRuns: 100 },
      );
    });

    it("A value of 8 bytes or more has a hex form: the hex of its UTF-8, in lower and in upper case, inside a longer run of hex digits, logs `[secret]`.", async () => {
      const t = await thrower(mode);
      await fc.assert(
        fc.asyncProperty(secret(8, 40), fc.boolean(), fc.stringMatching(/^[0-9a-f]{0,8}$/), async (v, upper, pad) => {
          const h = hexOf(utf8(v));
          const e = upper ? h.toUpperCase() : h;
          const out = await t.run(v, `x ${pad}${e}${pad} y`);
          expect(out.messages).toHaveLength(1);
          const rest = afterPrefix(out.messages[0] ?? "");
          expect(rest).toContain("[secret]");
          expect(rest.toLowerCase()).not.toContain(h);
        }),
        { seed: SEED, numRuns: 80 },
      );
    });
  });
}

// ---- Views, as an attacker reads them: values that hold `+` and escape-looking text of every family ----
const VIEWS_SINGLE =
  "The text is read as is, as each of its two decoded views, as each of the two decoded views of each of those, and as a view of each family of escapes alone, any other unit as is, and as that family's view of that view: the `%` escapes with `+` (as a space, and as `+`), the backslash escapes, the entities.";
const ESCAPE_LOOKING = [
  "%41",
  "%2B",
  "%2b",
  "%",
  "%4",
  "&amp;",
  "&lt;",
  "&#39;",
  "&#x41;",
  "&",
  "&#",
  "\\n",
  "\\u0041",
  "\\\\",
  "\\",
  "+",
  "a+b",
  '"',
  "A",
  "x",
  "k9",
  " ",
];
// The stated limit (privacy-scrub-limits.test.ts): a value holding an escape of one family under two escapings of two different families, one of which leaves that escape as is (JSON, then URL). The same escaping twice is not that limit and is asserted.
const TWO_FAMILIES = new Set(["encodeURIComponent of its JSON.stringify less the quotes"]);
const holdsLeftAsIs = (v: string): boolean =>
  /%[0-9a-fA-F]{2}|&(?:amp|lt|gt|quot|apos|#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6});/.test(v);
/** A value of 8 or more bytes built from `+`, escape-looking atoms of every family and plain letters. */
const escapeValue: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...ESCAPE_LOOKING), { minLength: 3, maxLength: 7 })
  .map((a) => a.join(""))
  .filter((v) => utf8(v).length >= 8);
const escapeFragment = fc.constantFrom(
  "%41",
  "%2B",
  "+",
  "&amp;",
  "&#39;",
  "&#x41;",
  "\\n",
  "\\u0041",
  "\\\\",
  "%",
  "&",
  "\\",
);
const escapeAround = fc.array(escapeFragment, { minLength: 0, maxLength: 5 }).map((a) => a.join(" "));

for (const mode of modes) {
  describe(`k.privacy Views, as an attacker reads them, in ${mode}`, () => {
    it(`${VIEWS_SINGLE} A value holding \`+\` or an escape of any family is marked under every single encoding of the bullet.`, async () => {
      const t = await thrower(mode);
      await fc.assert(
        fc.asyncProperty(
          escapeValue,
          text,
          text,
          fc.integer({ min: 0, max: ENCODINGS.length - 1 }),
          async (v, p, q, which) => {
            const entry = ENCODINGS[which];
            if (entry === undefined) throw new Error("fixture: no encoding");
            const [name, encode] = entry;
            fc.pre(!holdsAForm(p, v) && !holdsAForm(q, v));
            fc.pre(!(TWO_FAMILIES.has(name) && holdsLeftAsIs(v)));
            const out = await t.run(v, `${p}${encode(v)}${q}`);
            expect(out.messages).toHaveLength(1);
            const message = out.messages[0] ?? "";
            expect(
              holdsHeadMarkTail(message, p, q),
              `${name} of ${JSON.stringify(v)}: ${JSON.stringify(message)}`,
            ).toBe(true);
          },
        ),
        { seed: SEED, numRuns: 200 },
      );
    });

    it('A value holding an escape of one family is found under one or two escapings of another family that leave it as is: `JSON.stringify` of `a"b%41`, once or twice, and `encodeURI` of `x&amp;y z`, once or twice.', async () => {
      const t = await thrower(mode);
      const jsonOnce = JSON.stringify('a"b%41').slice(1, -1);
      const jsonTwice = JSON.stringify(jsonOnce).slice(1, -1);
      expect(jsonTwice).toBe('a\\\\\\"b%41');
      for (const e of [jsonOnce, jsonTwice]) {
        const a = await t.run('a"b%41', `x ${e} y`);
        expect(afterPrefix(a.messages[0] ?? ""), e).toBe("x [secret] y");
      }
      const once = encodeURI("x&amp;y z");
      for (const e of [once, encodeURI(once)]) {
        const b = await t.run("x&amp;y z", `x ${e} y`);
        expect(afterPrefix(b.messages[0] ?? ""), e).toBe("x [secret] y");
      }
    });

    it("A value holding an escape of one family is found under one or two escapings of another family that leave it as is: every single covered escaping applied once and twice to a value holding `+` and escapes of every family.", async () => {
      const t = await thrower(mode);
      await fc.assert(
        fc.asyncProperty(
          escapeValue,
          text,
          text,
          fc.integer({ min: 0, max: ESCAPERS.length - 1 }),
          fc.boolean(),
          async (v, p, q, which, twice) => {
            const entry = ESCAPERS[which];
            if (entry === undefined) throw new Error("fixture: no escaper");
            const [name, escape] = entry;
            fc.pre(!holdsAForm(p, v) && !holdsAForm(q, v));
            const e = twice ? escape(escape(v)) : escape(v);
            const out = await t.run(v, `${p}${e}${q}`);
            expect(out.messages).toHaveLength(1);
            const message = out.messages[0] ?? "";
            expect(
              holdsHeadMarkTail(message, p, q),
              `${name}${twice ? " twice" : ""} of ${JSON.stringify(v)}: ${JSON.stringify(message)}`,
            ).toBe(true);
          },
        ),
        { seed: SEED, numRuns: 100 },
      );
    });

    it("A `+` of the value is found whether an escaping wrote it as `%2B` or left it as is (`encodeURI`, JSON, HTML entities).", async () => {
      const t = await thrower(mode);
      const v = "a+b c&d<e";
      const texts = [
        encodeURIComponent(v),
        encodeURI(v),
        JSON.stringify(v).slice(1, -1),
        v.replace(/[&<]/g, (c) => (c === "&" ? "&amp;" : "&lt;")),
        v.replace(/\+/g, "%2B"),
        new URLSearchParams({ k: v }).toString().slice(2),
      ];
      for (const e of texts) {
        const out = await t.run(v, `x ${e} y`);
        expect(afterPrefix(out.messages[0] ?? ""), e).toBe("x [secret] y");
      }
    });

    it("A copy is marked at every offset in a surrounding text that itself holds escapes (`%41`, `%2B`, `+`, `&amp;`, `\\n`, `\\u0041`, a lone `%`, `&` or backslash), for a value that holds escapes and `+`.", async () => {
      const t = await thrower(mode);
      await fc.assert(
        fc.asyncProperty(
          escapeValue,
          escapeAround,
          escapeAround,
          fc.integer({ min: 0, max: ENCODINGS.length - 1 }),
          async (v, left, right, which) => {
            const entry = ENCODINGS[which];
            if (entry === undefined) throw new Error("fixture: no encoding");
            const [name, encode] = entry;
            fc.pre(!holdsAForm(left, v) && !holdsAForm(right, v));
            fc.pre(!(TWO_FAMILIES.has(name) && holdsLeftAsIs(v)));
            const p = left === "" ? "" : `${left} `;
            const q = right === "" ? "" : ` ${right}`;
            const out = await t.run(v, `${p}${encode(v)}${q}`);
            expect(out.messages).toHaveLength(1);
            const message = out.messages[0] ?? "";
            expect(
              holdsHeadMarkTail(message, p, q),
              `${name} of ${JSON.stringify(v)}: ${JSON.stringify(message)}`,
            ).toBe(true);
          },
        ),
        { seed: SEED, numRuns: 150 },
      );
    });
  });
}
