// The scrub's views read a `+` either way (k.privacy Views): a secret holding `+` is found under every escaping the
// views cover, whether the escaping wrote `+` as `%2B` or left it as is, alone or nested two deep, at every offset in
// a text. The second property covers the rest of the family: a secret holding the characters the views rewrite (`%`,
// `&`, `\`, `+`, a space, `;`, `#`) and escape-looking sequences of every family is found under each single escaping at
// every offset, the ones that leave another family's escape as is included (the one-family views). Under two
// escapings, one of which leaves such an escape as is, it is the stated limit. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { holdSecrets } from "../src/internal/holdSecrets.ts";
import { scrubbed } from "../src/internal/scrubbed.ts";

const SEED = 1337;
const hex4 = (c: string): string => c.charCodeAt(0).toString(16).padStart(4, "0");
const json = (v: string): string => JSON.stringify(v).slice(1, -1);
const qs = (v: string): string =>
  encodeURIComponent(v).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

type Kind = "pct" | "entity" | "backslash";
/** Each escaping the views cover, and the kinds of escape it leaves as is when the value holds one. */
const ESCAPINGS: ReadonlyArray<readonly [string, (v: string) => string, readonly Kind[]]> = [
  ["encodeURIComponent", encodeURIComponent, []],
  ["encodeURI", encodeURI, ["entity"]],
  ["qs", qs, []],
  ["form", (v) => new URLSearchParams({ k: v }).toString().slice(2), []],
  ["JSON", json, ["pct", "entity"]],
  ["JSON with \\u", (v) => json(v).replace(/[\u0080-￿]/g, (c) => `\\u${hex4(c)}`), ["pct", "entity"]],
  ["JSON with \\/", (v) => json(v).replaceAll("/", "\\/"), ["pct", "entity"]],
  ["HTML-safe JSON", (v) => json(v).replace(/[<>&']/g, (c) => `\\u${hex4(c)}`), ["pct"]],
  [
    "HTML named",
    (v) =>
      v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c),
    ["pct", "backslash"],
  ],
  ["HTML decimal", (v) => Array.from(v, (c) => `&#${String(c.codePointAt(0))};`).join(""), []],
  ["HTML hex", (v) => Array.from(v, (c) => `&#x${(c.codePointAt(0) ?? 0).toString(16)};`).join(""), []],
];

/** Whether `v` holds an escape of `kind` that the views read. */
const holds = (v: string, kind: Kind): boolean =>
  kind === "pct"
    ? /%[0-9a-f]{2}/i.test(v)
    : kind === "entity"
      ? /&(amp|lt|gt|quot|apos);|&#[0-9]{1,7};|&#[xX][0-9a-fA-F]{1,6};/.test(v)
      : /\\(["\\/bfnrt]|u[0-9a-fA-F]{4})/.test(v);
/** Whether escaping `v` with `e`, whose left-as-is kinds are `kinds`, leaves an escape of `v` as is and changes `v`. */
const limit = (v: string, e: (v: string) => string, kinds: readonly Kind[]): boolean =>
  e(v) !== v && kinds.some((k) => holds(v, k));

const mark = (text: string, v: string): string => {
  const set = new Set<string>();
  holdSecrets(set, [v]);
  return scrubbed(text, [
    [set, "[secret]"],
    [new Set<string>(), "[pii]"],
  ]);
};
/** The mark stands once, with text of `p` before it and of `q` after it, and no copy of the escaped text is left. */
const once = (out: string, p: string, q: string, e: string): boolean => {
  const i = out.indexOf("[secret]");
  return (
    i >= 0 &&
    out.indexOf("[secret]", i + 1) < 0 &&
    p.startsWith(out.slice(0, i)) &&
    q.endsWith(out.slice(i + "[secret]".length)) &&
    !out.includes(e)
  );
};

const plain = fc.stringMatching(/^[A-Za-z0-9 ]{0,12}$/);
const piece = fc.oneof(
  fc.constantFrom("+", "+", " ", "/", '"', "<", "&", "'", "é", "€", "😀", "\n", "\\"),
  fc.stringMatching(/^[a-z0-9]{1,4}$/),
);
/** A secret of 8 or more bytes holding at least one `+`. */
const withPlus = fc
  .tuple(fc.array(piece, { minLength: 1, maxLength: 8 }), fc.array(piece, { minLength: 1, maxLength: 8 }))
  .map(([a, b]) => `${a.join("")}+${b.join("")}`)
  .filter((v) => new TextEncoder().encode(v).length >= 8);

describe("a secret holding `+`", () => {
  it("is found under each escaping, `+` left as is or written `%2B`, at every offset", () => {
    fc.assert(
      fc.property(withPlus, plain, plain, fc.nat(ESCAPINGS.length - 1), (v, p, q, w) => {
        const [, e, kinds] = ESCAPINGS[w] ?? ESCAPINGS[0] ?? ["", (x: string) => x, []];
        fc.pre(!p.includes(v) && !q.includes(v));
        const text = e(v);
        for (let cut = 0; cut <= p.length; cut++) {
          const before = p.slice(0, cut);
          expect(once(mark(`${before}${text}${q}`, v), before, q, text), `${before}|${text}|${q}`).toBe(true);
        }
      }),
      { seed: SEED, numRuns: 400 },
    );
  });

  it("is found under every ordered pair of the escapings", () => {
    fc.assert(
      fc.property(
        withPlus,
        plain,
        plain,
        fc.nat(ESCAPINGS.length - 1),
        fc.nat(ESCAPINGS.length - 1),
        (v, p, q, i, j) => {
          const [, e1, k1] = ESCAPINGS[i] ?? ESCAPINGS[0] ?? ["", (x: string) => x, []];
          const [, e2, k2] = ESCAPINGS[j] ?? ESCAPINGS[0] ?? ["", (x: string) => x, []];
          fc.pre(!limit(v, e1, k1) && !limit(e1(v), e2, k2) && !p.includes(v) && !q.includes(v));
          const text = e2(e1(v));
          expect(once(mark(`${p}${text}${q}`, v), p, q, text), `${i} ${j} ${text}`).toBe(true);
        },
      ),
      { seed: SEED, numRuns: 600 },
    );
  });

  it("is found in base64 that JSON escaping wrote with `\\/` and left its `+` as is", () => {
    const bytes = new Uint8Array([0xfb, 0xff, 0xbf, 0xfb, 0xef, 0xbe, 0x01, 0x02, 0x03]);
    const v = new TextDecoder().decode(bytes);
    const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(v)));
    expect(b64).toMatch(/[+/]/);
    const text = b64.replaceAll("/", "\\/");
    expect(mark(`t=${text} end`, v)).toBe("t=[secret] end");
  });
});

const meta = fc.oneof(
  { weight: 3, arbitrary: fc.constantFrom("%", "&", "\\", "+", " ", ";", "#", "u", "n", "x", "4", "1", "a", "F") },
  {
    weight: 2,
    arbitrary: fc.constantFrom(
      "%41",
      "%C3%A9",
      "%zz",
      "%C3",
      "&amp;",
      "&#65;",
      "&#x41;",
      "&copy;",
      "\\n",
      "\\u0041",
      "\\x41",
    ),
  },
  { weight: 1, arbitrary: fc.constantFrom('"', "<", ">", "'", "/", "é", "😀") },
);
const family = fc
  .array(meta, { minLength: 3, maxLength: 12 })
  .map((a) => a.join(""))
  .filter((v) => new TextEncoder().encode(v).length >= 8);

describe("a secret holding the characters the views rewrite", () => {
  it("is found under each single escaping at every offset, one that leaves another family's escape as is included", () => {
    let raw = 0;
    fc.assert(
      fc.property(family, plain, plain, fc.nat(ESCAPINGS.length - 1), (v, p, q, w) => {
        const [, e, kinds] = ESCAPINGS[w] ?? ESCAPINGS[0] ?? ["", (x: string) => x, []];
        fc.pre(!p.includes(v) && !q.includes(v));
        if (limit(v, e, kinds)) raw++;
        const text = e(v);
        for (let cut = 0; cut <= p.length; cut++) {
          const before = p.slice(0, cut);
          expect(once(mark(`${before}${text}${q}`, v), before, q, text), `${before}|${text}|${q}`).toBe(true);
        }
      }),
      { seed: SEED, numRuns: 1500 },
    );
    // The run reaches the cases only a one-family view finds.
    expect(raw).toBeGreaterThan(50);
  });

  it('a password `a"b%41` written by JSON.stringify, `x&amp;y"z1` by JSON and encodeURI, `p\\n<q1234` by HTML named entities are found', () => {
    const named = ESCAPINGS.find(([n]) => n === "HTML named")?.[1] ?? ((x: string) => x);
    expect(mark(`pw=${JSON.stringify('a"b%41')} end`, 'a"b%41')).toBe('pw="[secret]" end');
    expect(mark(`pw=${JSON.stringify('x&amp;y"z1')} end`, 'x&amp;y"z1')).toBe('pw="[secret]" end');
    expect(mark(`u=${encodeURI("x&amp;y z1")} end`, "x&amp;y z1")).toBe("u=[secret] end");
    expect(mark(`h=${named("p\\n<q1234")} end`, "p\\n<q1234")).toBe("h=[secret] end");
  });

  it("is found under the same escaping applied twice, at every offset, a family's view applying twice", () => {
    let raw = 0;
    fc.assert(
      fc.property(family, plain, plain, fc.nat(ESCAPINGS.length - 1), (v, p, q, w) => {
        const [, e, kinds] = ESCAPINGS[w] ?? ESCAPINGS[0] ?? ["", (x: string) => x, []];
        fc.pre(!p.includes(v) && !q.includes(v));
        if (limit(v, e, kinds)) raw++;
        const text = e(e(v));
        for (let cut = 0; cut <= p.length; cut++) {
          const before = p.slice(0, cut);
          expect(once(mark(`${before}${text}${q}`, v), before, q, text), `${before}|${text}|${q}`).toBe(true);
        }
      }),
      { seed: SEED, numRuns: 800 },
    );
    expect(raw).toBeGreaterThan(25);
    const twice = JSON.stringify(JSON.stringify('a"b%41'));
    expect(twice).toBe('"\\"a\\\\\\"b%41\\""');
    expect(mark(`pw=${twice} end`, 'a"b%41')).toBe('pw="\\"[secret]\\"" end');
  });

  it('the limit that remains is nested: `a"b%41` JSON-escaped, then URL-encoded, logs as written', () => {
    const thrown = encodeURIComponent(JSON.stringify('a"b%41').slice(1, -1));
    expect(mark(`x ${thrown} y`, 'a"b%41')).toBe(`x ${thrown} y`);
  });

  it("a secret that is itself hex or base64 of other bytes is found as itself under each escaping", () => {
    for (const v of ["68656c6c6f20776f726c64", "aGVsbG8gd29ybGQ=", "aGVs+G8/d29ybGQ="])
      for (const [, e] of ESCAPINGS) expect(mark(`x ${e(v)} y`, v), e(v)).toBe("x [secret] y");
  });
});
