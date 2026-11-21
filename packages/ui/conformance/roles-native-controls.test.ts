// @vitest-environment happy-dom
// Spec: k.roles, Conformance "`slider` renders `<input type="range" min max value aria-label>` with no `role` attribute; `valueText` writes `aria-valuetext`; `fire(id, { type: 'input', value: '4' })` calls `onInput(4)`."
// Spec: k.roles, Conformance "Two `radio` parts with one `name` in a `radiogroup`: `fire(id, { type: 'change' })` on the second calls its `onChange` once; neither has a `role` attribute."
// Spec: k.roles, Native controls "A `div` with role `slider` or `radio` is not offered: it would rebuild a native control."
// Spec: k.roles, Attributes "Each optional prop writes one attribute (ARIA names unless marked HTML); a prop left undefined writes none."
// Spec: k.roles, Attributes "An ARIA boolean writes `"true"` or `"false"`; an HTML boolean is present or absent."
// Seed: 1337. The `fire` halves run under the harness in packages/testing/conformance/roles-harness.test.ts; here the DOM `input` and `change` events stand in.
import { Part } from "@keel/ui/aria";
import fc from "fast-check";
import { afterEach, describe, expect, expectTypeOf, test } from "vitest";
import { SEED, byId, cleanup, render } from "./roles-support.ts";

afterEach(cleanup);
type PartProps = Parameters<typeof Part>[0];

describe("k.roles: native controls", () => {
  test('`slider` renders `<input type="range" min max value aria-label>` with no `role` attribute', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 40 }), fc.integer({ min: 50, max: 100 }), (min, max) => {
        const value = min + 1;
        const { host, off } = render(() => Part({ id: "s", role: "slider", label: "Size", min, max, value }));
        const el = byId(host, "s");
        expect(el.tagName).toBe("INPUT");
        expect(el.getAttribute("type")).toBe("range");
        expect(el.getAttribute("min")).toBe(String(min));
        expect(el.getAttribute("max")).toBe(String(max));
        expect(el.getAttribute("aria-label")).toBe("Size");
        expect(el.hasAttribute("role")).toBe(false);
        expect(el instanceof HTMLInputElement && el.value).toBe(String(value));
        off();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("`valueText` writes `aria-valuetext`; `step`, `orientation` and `disabled` are written", () => {
    const { host, off } = render(() =>
      Part({
        id: "s",
        role: "slider",
        label: "Size",
        min: 0,
        max: 10,
        value: 4,
        valueText: "four",
        step: 2,
        orientation: "vertical",
        disabled: true,
      }),
    );
    const el = byId(host, "s");
    expect(el.getAttribute("aria-valuetext")).toBe("four");
    expect(el.getAttribute("step")).toBe("2");
    expect(el.getAttribute("aria-orientation")).toBe("vertical");
    expect(el.hasAttribute("disabled")).toBe(true);
    off();
  });

  test("an `input` event on a `slider` calls `onInput` with the number", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (n) => {
        const seen: number[] = [];
        const { host, off } = render(() =>
          Part({ id: "s", role: "slider", label: "Size", min: 0, max: 100, value: 0, onInput: (v) => seen.push(v) }),
        );
        const el = byId(host, "s");
        if (!(el instanceof HTMLInputElement)) throw new Error("fixture: not an input");
        el.value = String(n);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        expect(seen).toEqual([n]);
        off();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test('`radiogroup` renders a `<div role="radiogroup">` and `radio` an `<input type="radio" name aria-label>` with no `role` attribute', () => {
    const { host, off } = render(() =>
      Part({
        id: "g",
        role: "radiogroup",
        label: "Size",
        required: true,
        children: () => [
          Part({ id: "g.a", role: "radio", label: "Small", name: "size", checked: true, value: "s" }),
          Part({ id: "g.b", role: "radio", label: "Large", name: "size", checked: false, value: "l" }),
        ],
      }),
    );
    const group = byId(host, "g");
    expect(group.tagName).toBe("DIV");
    expect(group.getAttribute("role")).toBe("radiogroup");
    expect(group.getAttribute("aria-required")).toBe("true");
    for (const id of ["g.a", "g.b"]) {
      const el = byId(host, id);
      expect(el.tagName).toBe("INPUT");
      expect(el.getAttribute("type")).toBe("radio");
      expect(el.getAttribute("name")).toBe("size");
      expect(el.hasAttribute("role")).toBe(false);
    }
    const first = byId(host, "g.a");
    if (!(first instanceof HTMLInputElement)) throw new Error("fixture: not an input");
    expect(first.checked).toBe(true);
    off();
  });

  test("a `change` event on the second of two `radio` parts calls its `onChange` once and not the first's", () => {
    const calls: string[] = [];
    const { host, off } = render(() =>
      Part({
        id: "g",
        role: "radiogroup",
        label: "Size",
        children: () => [
          Part({ id: "g.a", role: "radio", label: "S", name: "size", checked: false, onChange: () => calls.push("a") }),
          Part({ id: "g.b", role: "radio", label: "L", name: "size", checked: false, onChange: () => calls.push("b") }),
        ],
      }),
    );
    byId(host, "g.b").dispatchEvent(new Event("change", { bubbles: true }));
    expect(calls).toEqual(["b"]);
    off();
  });

  test("types: no `div` with role `slider` or `radio` is offered; `slider` takes `onInput(number)`, `radio` takes `onChange()`", () => {
    expectTypeOf<{ id: string; role: "slider"; label: string; min: 0; max: 1; value: 0 }>().toMatchTypeOf<PartProps>();
    expectTypeOf<{ id: string; role: "slider"; min: 0; max: 1; value: 0 }>().not.toMatchTypeOf<PartProps>();
    expectTypeOf<{
      id: string;
      role: "radio";
      label: string;
      name: string;
      checked: boolean;
    }>().toMatchTypeOf<PartProps>();
    expectTypeOf<{ id: string; role: "radio"; label: string; name: string }>().not.toMatchTypeOf<PartProps>();
    expectTypeOf<Extract<PartProps, { role: "slider" }>["onInput"]>().toEqualTypeOf<
      ((value: number) => void) | undefined
    >();
    expectTypeOf<Extract<PartProps, { role: "radio" }>["onChange"]>().toEqualTypeOf<(() => void) | undefined>();
    expectTypeOf<Extract<PartProps, { role: "slider" | "radio" }>>().not.toHaveProperty("tag");
    expect(true).toBe(true);
  });
});

describe("k.roles: attribute table, native controls", () => {
  type Row = { name: string; make: () => Node; attr: string; expected: string };
  const slider = (props: object) => () =>
    Part({ id: "e", role: "slider", label: "S", min: 0, max: 10, value: 4, ...props });
  const radio = (props: object) => () =>
    Part({ id: "e", role: "radio", label: "R", name: "n", checked: false, ...props });
  const rows: Row[] = [
    { name: "`min` on `slider` writes the HTML `min`", make: slider({ min: 2 }), attr: "min", expected: "2" },
    { name: "`max` on `slider` writes the HTML `max`", make: slider({ max: 9 }), attr: "max", expected: "9" },
    { name: "`value` on `slider` writes the HTML `value`", make: slider({ value: 5 }), attr: "value", expected: "5" },
    { name: "`step` on `slider` writes the HTML `step`", make: slider({ step: 2 }), attr: "step", expected: "2" },
    {
      name: "`valueText` on `slider` writes `aria-valuetext`",
      make: slider({ valueText: "four" }),
      attr: "aria-valuetext",
      expected: "four",
    },
    {
      name: "`orientation` on `slider` writes `aria-orientation`",
      make: slider({ orientation: "vertical" }),
      attr: "aria-orientation",
      expected: "vertical",
    },
    { name: "`name` on `radio` writes the HTML `name`", make: radio({ name: "pick" }), attr: "name", expected: "pick" },
    { name: "`value` on `radio` writes the HTML `value`", make: radio({ value: "a" }), attr: "value", expected: "a" },
  ];
  test.each(rows)("$name", ({ make, attr, expected }) => {
    const { host, off } = render(make);
    expect(byId(host, "e").getAttribute(attr)).toBe(expected);
    off();
  });

  test("`required` on `radiogroup` writes `aria-required`", () => {
    for (const v of [true, false]) {
      const { host, off } = render(() =>
        Part({ id: "e", role: "radiogroup", label: "G", required: v, children: () => "x" }),
      );
      expect(byId(host, "e").getAttribute("aria-required")).toBe(String(v));
      off();
    }
  });

  test("`disabled` on `slider` and on `radio` writes the HTML `disabled` and no `aria-disabled`; absent when false", () => {
    for (const make of [slider, radio]) {
      const on = render(make({ disabled: true }));
      expect(byId(on.host, "e").hasAttribute("disabled")).toBe(true);
      expect(byId(on.host, "e").hasAttribute("aria-disabled")).toBe(false);
      on.off();
      const off = render(make({ disabled: false }));
      expect(byId(off.host, "e").hasAttribute("disabled")).toBe(false);
      off.off();
    }
  });

  test("`checked` on `radio` writes the HTML `checked`: present when true, absent when false", () => {
    const on = render(radio({ checked: true }));
    expect(byId(on.host, "e").hasAttribute("checked")).toBe(true);
    on.off();
    const off = render(radio({ checked: false }));
    expect(byId(off.host, "e").hasAttribute("checked")).toBe(false);
    off.off();
  });

  test("a prop left undefined writes no attribute", () => {
    const a = render(slider({}));
    for (const n of ["step", "aria-valuetext", "aria-orientation", "disabled"])
      expect(byId(a.host, "e").hasAttribute(n)).toBe(false);
    a.off();
    const b = render(radio({}));
    for (const n of ["value", "disabled"]) expect(byId(b.host, "e").hasAttribute(n)).toBe(false);
    b.off();
    const c = render(() => Part({ id: "e", role: "radiogroup", label: "G", children: () => "x" }));
    expect(byId(c.host, "e").hasAttribute("aria-required")).toBe(false);
    c.off();
  });
});
