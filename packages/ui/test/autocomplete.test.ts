// @vitest-environment happy-dom
// k.a11y Required props: `Input`, `TextArea` and `Select` write `autocomplete: Autofill` as the attribute.
import { mount } from "@keel/runtime-dom";
import { Input, Select, TextArea } from "@keel/ui";
import type { Autofill } from "@keel/ui";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const NAMES: readonly Autofill[] = ["off", "name", "email", "tel", "street-address", "bday", "postal-code"];

const markup = (view: () => Node): string => {
  const host = document.createElement("div");
  document.body.append(host);
  const off = mount(view, host);
  const html = host.innerHTML;
  off();
  host.remove();
  return html;
};

describe("autocomplete", () => {
  it("is the control's attribute on Input, TextArea and Select", () => {
    fc.assert(
      fc.property(fc.constantFrom(...NAMES), (a) => {
        expect(markup(() => Input({ id: "c", label: "C", autocomplete: a }))).toContain(`autocomplete="${a}"`);
        expect(markup(() => TextArea({ id: "c", label: "C", autocomplete: a }))).toContain(`autocomplete="${a}"`);
        expect(markup(() => Select({ id: "c", label: "C", autocomplete: a }))).toContain(`autocomplete="${a}"`);
      }),
      { seed: 1337, numRuns: 14 },
    );
  });

  it("is absent without the prop", () => {
    expect(markup(() => Input({ id: "c", label: "C" }))).not.toContain("autocomplete");
  });
});
