// @vitest-environment happy-dom
// Property seed: 1337. rfc:0056: list URL attributes, SVG animation values, refused names (`on*`, `<base>` `href`).
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { URL_ATTRS, isRefusedAttr, isSafeUrl, safeUrl } from "../src/url/index.ts";
import { SEED } from "./support.ts";

describe("isSafeUrl lists (rfc:0056)", () => {
  it("checks every srcset/imagesrcset/ping item split at whitespace and commas", () => {
    for (const n of ["srcset", "imagesrcset", "ping"]) {
      expect(isSafeUrl(n, "a.png 1x, https://cdn.example/b.png 2x")).toBe(true);
      expect(isSafeUrl(n, "a.png 1x,javascript:x 2x")).toBe(false);
      expect(isSafeUrl(n, "a.png\tjavascript:x")).toBe(false);
      expect(isSafeUrl(n, "a.png 1x,\n javascript:x")).toBe(false);
    }
  });

  it("checks every ; item of values, and to/from/by whole", () => {
    expect(isSafeUrl("values", "0;1;0")).toBe(true);
    expect(isSafeUrl("values", "https://a.example; javascript:x")).toBe(false);
    expect(isSafeUrl("VALUES", "#a;\u0001javascript:x")).toBe(false);
    for (const n of ["to", "from", "by"]) {
      expect(isSafeUrl(n, "rotate(360 50 50)")).toBe(true);
      expect(isSafeUrl(n, "url(#g)")).toBe(true);
      expect(isSafeUrl(n, " javascript:x")).toBe(false);
    }
    expect(isSafeUrl("data", "movie.svg")).toBe(true);
    expect(isSafeUrl("data", "data:text/html,x")).toBe(false);
  });

  it("any value of a URL attribute is returned unchanged or as about:blank, and a javascript item blanks it", () => {
    const lists = new Map([
      ["ping", ","],
      ["srcset", ","],
      ["imagesrcset", " "],
      ["values", ";"],
    ]);
    fc.assert(
      fc.property(fc.constantFrom(...URL_ATTRS), fc.string(), fc.string(), (n, a, b) => {
        const v = safeUrl(n, a);
        expect(v === a || v === "about:blank").toBe(true);
        const sep = lists.get(n);
        const bad = sep === undefined ? `javascript:${b}` : `${a.replace(/[;,\s]/g, "")}${sep}javascript:${b}`;
        expect(safeUrl(n, bad)).toBe("about:blank");
      }),
      { seed: SEED, numRuns: 200 },
    );
  });
});

describe("isRefusedAttr (rfc:0056)", () => {
  it("refuses every on* name in any case, and href only on base", () => {
    fc.assert(
      fc.property(fc.constantFrom("on", "ON", "On", "oN"), fc.string({ maxLength: 8 }), fc.string(), (p, rest, tag) => {
        expect(isRefusedAttr(tag, `${p}${rest}`)).toBe(true);
      }),
      { seed: SEED, numRuns: 100 },
    );
    expect(isRefusedAttr("base", "HREF")).toBe(true);
    expect(isRefusedAttr("BASE", "href")).toBe(true);
    expect(isRefusedAttr("base", "target")).toBe(false);
    expect(isRefusedAttr("a", "href")).toBe(false);
    expect(isRefusedAttr("div", "data-on")).toBe(false);
    expect(isRefusedAttr("div", "title")).toBe(false);
  });

  it("refuses http-equiv only on meta, in any case (rfc:0058)", () => {
    expect(isRefusedAttr("meta", "http-equiv")).toBe(true);
    expect(isRefusedAttr("META", "HTTP-EQUIV")).toBe(true);
    expect(isRefusedAttr("meta", "content")).toBe(false);
    expect(isRefusedAttr("meta", "name")).toBe(false);
    expect(isRefusedAttr("div", "http-equiv")).toBe(false);
    expect(isRefusedAttr("meta", "httpequiv")).toBe(false);
  });
});
