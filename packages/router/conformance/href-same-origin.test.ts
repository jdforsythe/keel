// @vitest-environment happy-dom
// Spec: k.router (Links) "Params are encoded by schema then URL-encoded, one segment each (`''` throws E1503); search keys are sorted and absent optionals omitted. An `Href` starts with one `/` and holds no `\`, control character or `#`."
// Seed 1337 (fc.assert below).
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, thrown } from "./contract-support.ts";

const c = contract("a", {
  "a.root": { path: "/" },
  "a.one": { path: "/:p", params: s.object({ p: s.string() }) },
  "a.two": {
    path: "/:p/:q",
    params: s.object({ p: s.string(), q: s.string() }),
    search: s.object({ t: s.string().optional() }),
  },
});
// The clause names control characters: C0 and C1 and DEL.
const isControl = (v: string): boolean =>
  [...v].some((ch) => {
    const n = ch.charCodeAt(0);
    return n <= 0x1f || (n >= 0x7f && n <= 0x9f);
  });
const anyText = fc.string({ unit: "binary" });
const nonEmpty = anyText.filter((v) => v.length > 0);
const wellFormed = (href: string): boolean =>
  href.startsWith("/") && !href.startsWith("//") && !href.includes("\\") && !isControl(href) && !href.includes("#");

describe("k.router Links: an Href", () => {
  it("`href` throws E1503 for an empty path param, in any position", () => {
    expect(thrown(() => Reflect.apply(c.href, c, ["a.one", { p: "" }]))?.code).toBe("E1503");
    expect(thrown(() => Reflect.apply(c.href, c, ["a.two", { p: "x", q: "" }]))?.code).toBe("E1503");
    expect(thrown(() => Reflect.apply(c.href, c, ["a.two", { p: "", q: "x" }]))?.code).toBe("E1503");
  });

  it("for any non-empty path params and search value, `href` starts with one `/` and holds no `\\`, control character or `#`", () => {
    fc.assert(
      fc.property(nonEmpty, nonEmpty, anyText, (p, q, t) => {
        const one = c.href("a.one", { p });
        const two = c.href("a.two", { p, q }, { t });
        expect(wellFormed(one), JSON.stringify(one)).toBe(true);
        expect(wellFormed(two), JSON.stringify(two)).toBe(true);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("a param that is a path, a backslash or `//` stays one segment: `/` is `%2F` and `\\` is `%5C`", () => {
    expect(c.href("a.one", { p: "/evil.example" })).toBe("/%2Fevil.example");
    expect(c.href("a.one", { p: "\\evil" })).toBe("/%5Cevil");
    expect(c.href("a.one", { p: "//" })).toBe("/%2F%2F");
  });
});
