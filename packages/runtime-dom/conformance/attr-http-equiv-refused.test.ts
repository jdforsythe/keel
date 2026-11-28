// k.runtime, Ops "`attr` binds nothing for an `on*` name, a `<base>` `href` or a `<meta>` `http-equiv`."
// @vitest-environment happy-dom
// RFC 0058 / backlog 0158: `<meta http-equiv="refresh" content={x}>` redirected on load. The server owns document
// headers, so app code never sets `http-equiv`. Property seed: 1337.
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { attr } from "@keel/runtime-dom/ops";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, inScope } from "./fixtures.ts";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

/** Binds `attr(el, name, () => value)` in a mounted component and returns the element's attribute names, lowercased. */
const bound = (el: Element, name: string, value: string): string[] => {
  const { value: unmount, dispose } = inScope(() =>
    mount(
      () => {
        attr(el, name, () => value);
        return el;
      },
      document.createElement("div"),
      { ctx: simCtx },
    ),
  );
  const names = el.getAttributeNames().map((n) => n.toLowerCase());
  unmount();
  dispose();
  return names;
};

const caseVariant = (s: string, mask: readonly boolean[]): string =>
  [...s].map((ch, i) => (mask[i % mask.length] === true ? ch.toUpperCase() : ch)).join("");

describe("k.runtime: attr binds nothing for a <meta> http-equiv", () => {
  it("attr(meta, 'http-equiv', () => 'refresh') sets nothing; content alone stays", () => {
    const el = document.createElement("meta");
    expect(bound(el, "http-equiv", "refresh")).toEqual([]);
    expect(bound(el, "content", "0;url=https://evil.example")).toEqual(["content"]);
  });

  it("no case of http-equiv with any value sets the attribute on a meta", () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 10, maxLength: 10 }), fc.string(), (mask, v) => {
        const el = document.createElement("meta");
        expect(bound(el, caseVariant("http-equiv", mask), v)).not.toContain("http-equiv");
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("http-equiv is not refused on other elements, and meta name/content still set", () => {
    expect(bound(document.createElement("div"), "http-equiv", "x")).toEqual(["http-equiv"]);
    expect(bound(document.createElement("meta"), "name", "description")).toEqual(["name"]);
  });
});
