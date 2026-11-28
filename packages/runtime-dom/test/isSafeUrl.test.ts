// Property seed: 1337. k.runtime URL rule through the predicate (`isSafeUrl`), item by item.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isSafeUrl } from "../src/url/index.ts";
import { SEED } from "./support.ts";

describe("isSafeUrl: scheme allow-list", () => {
  it("keeps each of http, https, mailto and tel, in any case", () => {
    for (const s of ["http", "https", "mailto", "tel", "HTTP", "Https", "MAILTO", "Tel"]) {
      expect(isSafeUrl("href", `${s}:x`)).toBe(true);
    }
  });

  it("refuses other schemes, in any case", () => {
    for (const v of ["javascript:x", "JavaScript:x", "data:text/html,x", "ftp:x", "vbscript:x", "a+b.c-d:x", "x:"]) {
      expect(isSafeUrl("href", v)).toBe(false);
    }
  });

  it("treats a value that does not begin with a scheme as relative", () => {
    for (const v of [
      "",
      "a",
      "1abc:x",
      "-a:x",
      "+a:x",
      ".a:x",
      "foo/javascript:x",
      "?javascript:x",
      "#javascript:x",
      "//host/p",
      "/a:b",
      " :x",
    ]) {
      expect(isSafeUrl("href", v)).toBe(true);
    }
  });

  it("is case-insensitive in the attribute name and ignores non-URL attributes", () => {
    expect(isSafeUrl("HREF", "javascript:x")).toBe(false);
    expect(isSafeUrl("title", "javascript:x")).toBe(true);
    expect(isSafeUrl("srcdoc", "<p>x</p>")).toBe(false);
  });

  it("drops leading C0 controls and spaces and ignores tab, CR and LF inside the scheme", () => {
    for (const v of [
      " javascript:x",
      "\u0001javascript:x",
      "\u0000 \u001fjavascript:x",
      "java\tscript:x",
      "java\nscript:x",
      "ja\rvascript:x",
      "\n\t javascript:x",
    ]) {
      expect(isSafeUrl("href", v)).toBe(false);
    }
    expect(isSafeUrl("href", " \u0001ht\ttp:x")).toBe(true);
    expect(isSafeUrl("href", "\u0001")).toBe(true);
  });

  it("reads only the first 64 characters for a scheme", () => {
    expect(isSafeUrl("href", `${"a".repeat(64)}:x`)).toBe(true);
    expect(isSafeUrl("href", `${"a".repeat(63)}:x`)).toBe(false);
    expect(isSafeUrl("href", `${"a".repeat(80)}:x`)).toBe(true);
    expect(isSafeUrl("href", `\t${"a\t".repeat(62)}a:x`)).toBe(false);
  });

  it("a value with a disallowed scheme is unsafe whatever follows it", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 20 }), (rest) => {
        expect(isSafeUrl("src", `javascript:${rest}`)).toBe(false);
        expect(isSafeUrl("src", `https:${rest}`)).toBe(true);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});

describe("isSafeUrl: list attributes", () => {
  const SEPARATORS = [" ", "\t", "\n", "\f", "\r", ","];

  it("splits ping, srcset and imagesrcset at whitespace and commas and checks every item", () => {
    for (const n of ["ping", "srcset", "imagesrcset", "SRCSET"]) {
      for (const sep of SEPARATORS) {
        expect(isSafeUrl(n, `a.png${sep}javascript:x`)).toBe(false);
        expect(isSafeUrl(n, `javascript:x${sep}a.png`)).toBe(false);
        expect(isSafeUrl(n, `a.png${sep}b.png`)).toBe(true);
      }
      expect(isSafeUrl(n, "a.png;javascript:x")).toBe(true);
    }
  });

  it("splits values at semicolons only", () => {
    expect(isSafeUrl("values", "0;javascript:x;1")).toBe(false);
    expect(isSafeUrl("values", "0;1;https://a.example")).toBe(true);
    expect(isSafeUrl("values", "a b,javascript:x")).toBe(true);
  });
});
