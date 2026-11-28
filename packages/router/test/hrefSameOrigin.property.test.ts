// k.router Links: an `Href` is a same-origin path. `href` refuses an empty path param (E1503); `isHref` refuses `//`,
// a backslash and a control character, so no built link is protocol-relative.
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { contract } from "../src/contract/contract.ts";
import { isHref } from "../unsafe/isHref.ts";

const c = contract("ap", {
  "ap.open": { path: "/:a/:b", params: s.object({ a: s.string(), b: s.string() }) },
});
const codeOf = (f: () => unknown): unknown => {
  try {
    f();
    return null;
  } catch (e) {
    return e instanceof Error && "code" in e ? e.code : e;
  }
};
const sameOrigin = (href: string): boolean => {
  const u = new URL(href, "https://app.example");
  return u.origin === "https://app.example" && href.startsWith("/") && !href.startsWith("//");
};
const piece = fc.oneof(
  fc.string(),
  fc.constantFrom("", "/", "//", "\\", "/\\", "evil.example", ".", "..", "\t", "\n", "%2F", "@evil.example"),
);

describe("href stays on the origin", () => {
  it("`ap.href('ap.open', { a: '', b: 'evil.example' })` throws E1503, not `//evil.example`", () => {
    expect(codeOf(() => c.href("ap.open", { a: "", b: "evil.example" }))).toBe("E1503");
  });

  it("for generated params, href throws E1503 for an empty one, else is a same-origin path", () => {
    fc.assert(
      fc.property(piece, piece, (a, b) => {
        if (a === "" || b === "") expect(codeOf(() => c.href("ap.open", { a, b }))).toBe("E1503");
        else expect(sameOrigin(c.href("ap.open", { a, b }))).toBe(true);
      }),
      { seed: 1337, numRuns: 300 },
    );
  });

  it("isHref refuses `//`, `/\\`, a backslash and a control character", () => {
    for (const bad of ["//evil.example", "/\\evil.example", "/a\\b", "/a\tb", "/a\nb", "/a\u007fb", "x", "/a#b"])
      expect(isHref(bad)).toBe(false);
    for (const good of ["/", "/a", "/a/b?c=%2F%2F", "/%5Cevil.example"]) expect(isHref(good)).toBe(true);
  });

  it("whatever isHref accepts parses to the same origin", () => {
    fc.assert(
      fc.property(fc.string(), (tail) => {
        const p = `/${tail}`;
        if (isHref(p)) expect(sameOrigin(p)).toBe(true);
      }),
      { seed: 1337, numRuns: 500 },
    );
  });
});
