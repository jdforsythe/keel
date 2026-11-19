// Spec: k.runtime, clause "JSX spread `{...{ onclick: 'alert(1)' }}` creates no `onclick` attribute."
// Also Ops: "`attr` binds nothing for an `on*` name, a `<base>` `href` or a `<meta>` `http-equiv`." Property seed: 1337.
// @vitest-environment happy-dom
// The JSX-spread repro goes through the compiler, which is not a dependency of @keel/runtime-dom; it lives in
// packages/compiler/conformance/url-policy-0056.test.ts. Here the lowered op `attr(el, 'onclick', fn)` is called directly.
import { mount } from "@keel/runtime-dom";
import { attr } from "@keel/runtime-dom/ops";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, inScope } from "./fixtures.ts";

type V = string | boolean;

/** Binds `attr(el, name, () => value)` in a mounted component and returns the element's attribute names. */
const bound = (el: Element, name: string, value: V): string[] => {
  const { value: unmount, dispose } = inScope(() =>
    mount(() => {
      attr(el, name, () => value);
      return el;
    }, document.createElement("div")),
  );
  const names = el.getAttributeNames();
  unmount();
  dispose();
  return names;
};

const lower = (xs: readonly string[]): string[] => xs.map((x) => x.toLowerCase());

const caseVariant = (s: string, mask: readonly boolean[]): string =>
  [...s].map((ch, i) => (mask[i % mask.length] === true ? ch.toUpperCase() : ch)).join("");

const nameChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_:".split("");
const suffix = fc.stringOf(fc.constantFrom(...nameChars), { maxLength: 12 });
const onName = fc
  .tuple(fc.array(fc.boolean(), { minLength: 2, maxLength: 2 }), suffix)
  .map(([mask, rest]) => `${caseVariant("on", mask)}${rest}`);
const anyValue = fc.oneof(fc.string(), fc.constant(true));

describe("k.runtime: attr binds nothing for an on* name or a <base> href", () => {
  it("attr(el, 'onclick', fn) creates no onclick attribute", () => {
    const el = document.createElement("div");
    expect(lower(bound(el, "onclick", "alert(1)"))).not.toContain("onclick");
    expect(el.hasAttribute("onclick")).toBe(false);
  });

  it("attr sets no attribute for any on* name, in any case, with any value", () => {
    fc.assert(
      fc.property(fc.constantFrom("div", "a", "button", "img", "svg"), onName, anyValue, (tag, name, v) => {
        const el = document.createElement(tag);
        expect(lower(bound(el, name, v)).includes(name.toLowerCase())).toBe(false);
        expect(el.getAttributeNames()).toEqual([]);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("attr(baseEl, 'href', fn) sets no href, even for a protocol-relative URL", () => {
    const el = document.createElement("base");
    expect(bound(el, "href", "//evil.example")).not.toContain("href");
    expect(el.hasAttribute("href")).toBe(false);
  });

  it("attr(baseEl, 'href', fn) sets no href for any string value", () => {
    fc.assert(
      fc.property(fc.string(), (v) => {
        const el = document.createElement("base");
        expect(bound(el, "href", v)).not.toContain("href");
      }),
      { seed: SEED, numRuns: 50 },
    );
  });

  it("attr(aEl, 'href', fn) still sets an https href (clean counterpart)", () => {
    const el = document.createElement("a");
    expect(bound(el, "href", "https://ok.example")).toContain("href");
    expect(el.getAttribute("href")).toBe("https://ok.example");
  });

  it("attr still sets names that merely contain on, such as data-on and title (clean counterpart)", () => {
    const el = document.createElement("div");
    bound(el, "data-on", "x");
    bound(el, "title", "t");
    expect(el.getAttribute("data-on")).toBe("x");
    expect(el.getAttribute("title")).toBe("t");
  });
});
