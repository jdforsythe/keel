// @vitest-environment happy-dom
// Spec: k.a11y, Conformance "An `Input` bound to a `.pii('contact')` field without `autocomplete` fails its render with E1821; with `autocomplete=\"email\"` or `\"off\"` it passes and the attribute is in the markup."
// Spec: k.a11y, Rules "E1821 a control bound to a `.pii()` field without `autocomplete` (render)"
// Seed: 1337.
// Assumed: `form(schema)` from @keel/forms is called in the component body and its `field(path)` is passed as `field` (k.forms, k.ui Input).
import { form } from "@keel/forms";
import { mount } from "@keel/runtime-dom";
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import { Input } from "@keel/ui";
import type { Autofill } from "@keel/ui";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, codeOf, messageOf, simCtx, thrown } from "./fixtures.ts";

const Contact = s.object({ email: s.string().pii("contact") });
const view = (autocomplete?: Autofill) =>
  Object.assign(
    () => {
      const f = form(Contact);
      return autocomplete === undefined
        ? Input({ id: "pii.email", label: "Email", field: f.field("email") })
        : Input({ id: "pii.email", label: "Email", field: f.field("email"), autocomplete });
    },
    { Props: s.object({}) },
  );

describe("k.a11y: E1821 a control bound to a .pii() field without autocomplete", () => {
  it("E1821 An `Input` bound to a `.pii('contact')` field without `autocomplete` fails its render with E1821", async () => {
    const e = await thrown(() => render(view(), { props: {}, ctx: simCtx() }));
    expect(codeOf(e)).toBe("E1821");
    expect(messageOf(e)).toContain("pii.email");
  });

  it('with `autocomplete="email"` or `"off"` it passes and the attribute is in the markup', async () => {
    for (const value of ["email", "off"] as const) {
      const t = render(view(value), { props: {}, ctx: simCtx() });
      expect(t.find("pii.email").id).toBe("pii.email");
      t.dispose();
      const host = document.createElement("div");
      document.body.append(host);
      const off = mount(view(value), host);
      expect(host.querySelector("#pii\\.email")?.getAttribute("autocomplete")).toBe(value);
      off();
      host.remove();
    }
  });

  it("any autofill name or `off` on the pii control passes (property)", () => {
    const names = ["name", "email", "tel", "street-address", "bday", "off"] as const;
    fc.assert(
      fc.property(fc.constantFrom(...names), (value) => {
        const t = render(view(value), { props: {}, ctx: simCtx() });
        t.dispose();
      }),
      { seed: SEED, numRuns: 12 },
    );
  });

  it("a control not bound to a pii field needs no `autocomplete`", () => {
    const plain = Object.assign(() => Input({ id: "plain", label: "Note" }), { Props: s.object({}) });
    const t = render(plain, { props: {}, ctx: simCtx() });
    t.dispose();
    expect(true).toBe(true);
  });
});
