// Spec: k.origins, Conformance "E1590: `https://*.cdn.example`, `https://cdn.example/img`, `http://cdn.example`, `script: {...}`, reason `''`, a reason with a line break, one of 201 characters, `origins: shared`, 17 origins; `https://cdn.example/`, `https://CDN.example` and `https://cdn.example:443` with the fix `https://cdn.example`; `http://localhost:9000` and `https://cdn.example:8443` are none; `topology()` throws E1590 for `https://cdn.example/`."
// Spec: k.origins, Rules "E1590 an `origins` the static read cannot take (not an object literal, a spread or computed key), a key outside the five, an origin that is not exact (fix: the key as its `originOf` serialization when that is exact; none for a path, as `https://cdn.example/img`), a reason out of form, or a directive over 16 (check, build, dev; `topology()` throws `Error('E1590 <deployable>: ...')`)"
// Spec: k.origins, Declaration "A reason is 1 to 200 characters on one line, one visible. A directive holds at most 16 origins."
// Seed 1337 (fc.assert below). The `topology()` throw is packages/server/conformance/origins-topology-throws.test.ts; build and dev are not exercised here.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, decl, single, withCode } from "./origins-support.ts";

const e1590 = (origins: string, prelude = "") => {
  const files = single(origins).map((f) => (f.path === "topology.ts" ? { ...f, source: `${prelude}${f.source}` } : f));
  return withCode(files, "E1590");
};
const img = (origin: string) => decl("img", origin);
/** The text of the one line a fix removes and the one it adds (the patch is a unified diff of one changed line). */
function changed(fix: string | undefined): { removed: string; added: string } {
  const lines = (fix ?? "").split("\n");
  const rm = lines.filter((l) => l.startsWith("-") && !l.startsWith("---"));
  const ad = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++"));
  expect(rm).toHaveLength(1);
  expect(ad).toHaveLength(1);
  return { removed: (rm[0] ?? "").slice(1), added: (ad[0] ?? "").slice(1) };
}
/** The fix rewrites the key `from` as the key `to` and changes nothing else on the line. */
function rewritesKey(fix: string | undefined, from: string, to: string): boolean {
  const { removed, added } = changed(fix);
  return removed.includes(`'${from}'`) && added === removed.replace(`'${from}'`, `'${to}'`);
}

describe("k.origins: E1590", () => {
  test("E1590: `https://*.cdn.example` is one E1590", () => {
    expect(e1590(img("https://*.cdn.example"))).toHaveLength(1);
  });
  test("E1590: `https://cdn.example/img` is one E1590", () => {
    expect(e1590(img("https://cdn.example/img"))).toHaveLength(1);
  });
  test("E1590: `http://cdn.example` is one E1590", () => {
    expect(e1590(img("http://cdn.example"))).toHaveLength(1);
  });
  test("E1590: `script: {...}` is one E1590, for a key outside the five", () => {
    expect(e1590(decl("script", "https://cdn.example"))).toHaveLength(1);
    expect(e1590(decl("style", "https://cdn.example"))).toHaveLength(1);
    expect(e1590(decl("manifest", "https://cdn.example"))).toHaveLength(1);
  });
  test("E1590: each of the five keys with an exact origin is none", () => {
    for (const key of ["img", "media", "font", "connect", "frame"]) {
      expect(e1590(decl(key, "https://cdn.example"))).toEqual([]);
    }
  });
  test("E1590: reason `''` is one E1590", () => {
    expect(e1590("{ img: { 'https://cdn.example': '' } }")).toHaveLength(1);
  });
  test("E1590: a reason with no visible character is one E1590", () => {
    expect(e1590("{ img: { 'https://cdn.example': '   ' } }")).toHaveLength(1);
  });
  test("E1590: a reason with a line break is one E1590", () => {
    expect(e1590("{ img: { 'https://cdn.example': 'a\\nb' } }")).toHaveLength(1);
    expect(e1590("{ img: { 'https://cdn.example': `a\nb` } }")).toHaveLength(1);
  });
  test("E1590: a reason of 201 characters is one E1590, and of 1 and 200 is none", () => {
    const of = (n: number) => `{ img: { 'https://cdn.example': '${"x".repeat(n)}' } }`;
    expect(e1590(of(201))).toHaveLength(1);
    expect(e1590(of(200))).toEqual([]);
    expect(e1590(of(1))).toEqual([]);
  });
  test("E1590: a reason that is not a string literal is one E1590", () => {
    expect(e1590("{ img: { 'https://cdn.example': 42 } }")).toHaveLength(1);
  });
  test("E1590: `origins: shared` is one E1590", () => {
    expect(e1590("shared", "const shared = { img: { 'https://cdn.example': 'r' } }\n")).toHaveLength(1);
  });
  test("E1590: a directive that is not an object literal, a spread and a computed key are each one E1590", () => {
    const pre = "const shared = { 'https://cdn.example': 'r' }\nconst k = 'https://cdn.example'\n";
    expect(e1590("{ img: shared }", pre)).toHaveLength(1);
    expect(e1590("{ ...{ img: { 'https://cdn.example': 'r' } } }", pre)).toHaveLength(1);
    expect(e1590("{ img: { ...shared } }", pre)).toHaveLength(1);
    expect(e1590("{ img: { [k]: 'r' } }", pre)).toHaveLength(1);
  });
  test("E1590: 17 origins in one directive is one E1590, and 16 is none", () => {
    const hosts = (n: number) => Array.from({ length: n }, (_, i) => `https://h${i}.example`);
    expect(e1590(decl("img", ...hosts(17)))).toHaveLength(1);
    expect(e1590(decl("img", ...hosts(16)))).toEqual([]);
  });
  test("E1590: the limit of 16 is per directive, so 16 under `img` and 16 under `font` are none", () => {
    const hosts = Array.from({ length: 16 }, (_, i) => `https://h${i}.example`);
    const both = `{ img: { ${hosts.map((o) => `'${o}': 'r'`).join(", ")} }, font: { ${hosts.map((o) => `'${o}': 'r'`).join(", ")} } }`;
    expect(e1590(both)).toEqual([]);
  });
  test("E1590: `https://cdn.example/` is one E1590 with the fix `https://cdn.example`", () => {
    const [d] = e1590(img("https://cdn.example/"));
    expect(d).toBeDefined();
    expect(rewritesKey(d?.fix, "https://cdn.example/", "https://cdn.example")).toBe(true);
  });
  test("E1590: `https://CDN.example` is one E1590 with the fix `https://cdn.example`", () => {
    const found = e1590(img("https://CDN.example"));
    expect(found).toHaveLength(1);
    expect(rewritesKey(found[0]?.fix, "https://CDN.example", "https://cdn.example")).toBe(true);
  });
  test("E1590: `https://cdn.example:443` is one E1590 with the fix `https://cdn.example`", () => {
    const found = e1590(img("https://cdn.example:443"));
    expect(found).toHaveLength(1);
    expect(rewritesKey(found[0]?.fix, "https://cdn.example:443", "https://cdn.example")).toBe(true);
  });
  test("E1590: `https://cdn.example/img`, a path, has no fix, and neither has a wildcard or an `http` origin off `localhost`", () => {
    for (const o of [
      "https://cdn.example/img",
      "https://cdn.example/a/b",
      "https://*.cdn.example",
      "http://cdn.example",
    ]) {
      expect(e1590(img(o))[0]?.fix ?? null).toBeNull();
    }
  });
  test("E1590: `http://localhost:9000` and `https://cdn.example:8443` are none", () => {
    expect(e1590(img("http://localhost:9000"))).toEqual([]);
    expect(e1590(img("https://cdn.example:8443"))).toEqual([]);
  });
  test("E1590: an exact origin is none, one with a path, credentials, query or fragment is one", () => {
    const host = fc.stringMatching(/^[a-z]{3,10}$/);
    const tail = fc.constantFrom("/p", "?q=1", "#f", "/", "/a/b");
    fc.assert(
      fc.property(host, tail, (h, t) => {
        expect(e1590(img(`https://${h}.example`))).toEqual([]);
        expect(e1590(img(`https://${h}.example${t}`))).toHaveLength(1);
        expect(e1590(img(`https://user@${h}.example`))).toHaveLength(1);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });
  test("E1590: a host with an upper-case letter is one E1590 whose fix is the lower-case serialization", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{3,10}$/), (h) => {
        const found = e1590(img(`https://${h.toUpperCase()}.example`));
        expect(found).toHaveLength(1);
        expect(rewritesKey(found[0]?.fix, `https://${h.toUpperCase()}.example`, `https://${h}.example`)).toBe(true);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });
  test("E1590: no `origins`, `origins: {}` and an empty directive are none", () => {
    expect(withCode(single(undefined), "E1590")).toEqual([]);
    expect(e1590("{}")).toEqual([]);
    expect(e1590("{ img: {} }")).toEqual([]);
  });
});
