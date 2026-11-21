// @vitest-environment happy-dom
// Runtime half of the URL agreement table (red-team 0084); the compiler half runs the same table.
import { describe, expect, it } from "vitest";
import { mount } from "../src/index.ts";
import { attr, clone, template } from "../src/ops/index.ts";
import { RAW_HTML_ATTRS, URL_ATTRS, isSafeUrl, safeUrl } from "../src/url/index.ts";
import { testCtx } from "./testCtx.ts";
import { URL_CASES, URL_CASE_ATTRS, expectSafe } from "./urlCases.ts";

describe("URL agreement table: the runtime", () => {
  it("covers exactly URL_ATTRS and RAW_HTML_ATTRS", () => {
    expect(new Set(URL_CASE_ATTRS.map((x) => x.attr))).toEqual(new Set([...URL_ATTRS, ...RAW_HTML_ATTRS]));
  });

  for (const { tag, attr: name } of URL_CASE_ATTRS) {
    for (const c of URL_CASES) {
      it(`${tag} ${name}: ${c.label}`, () => {
        const safe = expectSafe(name, c);
        expect(isSafeUrl(name, c.value)).toBe(safe);
        expect(safeUrl(name, c.value)).toBe(safe ? c.value : "about:blank");
        const host = document.createElement("div");
        const T = template(`<${tag}></${tag}>`);
        const dispose = mount(
          () => {
            const el = clone(T);
            attr(el, name, () => c.value);
            return el;
          },
          host,
          { ctx: testCtx },
        );
        expect(host.firstElementChild?.getAttribute(name)).toBe(safe ? c.value : "about:blank");
        dispose();
      });
    }
  }
});
