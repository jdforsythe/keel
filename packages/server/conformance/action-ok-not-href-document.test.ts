// @vitest-environment happy-dom
// k.router (Links) "`Link to`, `navigate`, `Form action` and an action's `ok` take `Href` only, rechecked when run (server and client): else `Link` renders `about:blank`, `Form` throws E1501, `ok` is `keel.unexpected` (nothing saved or followed), and `navigate` rejects (E1501) unless it is one once `\` reads as `/` and `#…` drops."
// rfc:0157 conformance: a page action returning a raw non-`Href` answers a document POST 500 with no `location` and saves no store it changed.
// Seed 1337 (fc.assert below).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { BAD, SEED, homeHref, setup } from "./ok-not-href-support.ts";

describe("rfc:0157 conformance: an action's `ok` that is no Href, document POST", () => {
  it("a page action returning `//evil.example/x`, `/\\evil.example`, `https://evil.example/`, `javascript:alert(1)` or a control character answers a document POST 500 `keel.unexpected` with no `location` and saves no store it changed", async () => {
    for (const to of BAD) {
      const t = await setup();
      const res = await t.document(to);
      expect(res.status, JSON.stringify(to)).toBe(500);
      expect(res.headers.get("location"), JSON.stringify(to)).toBeNull();
      const text = await res.text();
      expect(text, JSON.stringify(to)).toContain("keel.unexpected");
      expect(text, JSON.stringify(to)).not.toContain("evil.example");
      expect(await t.saved(), JSON.stringify(to)).toBeNull();
    }
  });

  it("for any generated hostile string, a document POST answers 500 with no `location` and saves nothing", async () => {
    const hostile = fc.oneof(
      fc.constantFrom("//", "/\\", "\\\\", "javascript:", "https://", "http:", "data:", "\u0085", "\u0000"),
      fc.string({ unit: "binary", maxLength: 12 }),
    );
    await fc.assert(
      fc.asyncProperty(hostile, hostile, async (a, b) => {
        const to = `${a}${b}`;
        // only strings that are no Href: the clause's own predicate
        const isHrefShape =
          to.startsWith("/") &&
          !to.startsWith("//") &&
          !to.includes("\\") &&
          !to.includes("#") &&
          ![...to].some((ch) => ch.charCodeAt(0) <= 0x1f || (ch.charCodeAt(0) >= 0x7f && ch.charCodeAt(0) <= 0x9f));
        fc.pre(!isHrefShape);
        const t = await setup();
        const res = await t.document(to);
        expect(res.status, JSON.stringify(to)).toBe(500);
        expect(res.headers.get("location"), JSON.stringify(to)).toBeNull();
        expect(await t.saved(), JSON.stringify(to)).toBeNull();
      }),
      { seed: SEED, numRuns: 60 },
    );
  });

  it("`ok(c.href(id))` still answers 303 to it and saves the store", async () => {
    const t = await setup();
    const res = await t.document(homeHref);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/");
    expect(await t.saved()).not.toBeNull();
  });
});
