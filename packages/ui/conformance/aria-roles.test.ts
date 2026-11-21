// @vitest-environment happy-dom
// Spec: k.aria, Conformance "`option` renders `<li role="option" aria-selected="false">`; `tab` a `<button type="button" role="tab">`; `columnheader` a `<th scope="col">` and `dialog` a `<dialog>`, neither with a `role` attribute."
// Seed: 1337.
// Roles paragraph (tag, ARIA props, `role` written only where it differs from the tag's implicit role) is covered by the extra tests below.
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { Part } from "@keel/ui/aria";
import fc from "fast-check";
import { afterEach, describe, expect, expectTypeOf, test } from "vitest";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

const SEED = 1337;
type PartProps = Parameters<typeof Part>[0];
type Of<R extends string> = Extract<PartProps, { role: R }>;

const hosts: HTMLElement[] = [];
afterEach(() => {
  for (const h of hosts.splice(0)) h.remove();
});
const render = (make: () => Node): { host: HTMLElement; off: () => void } => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  hosts.push(host);
  return { host, off: mount(make, host, { ctx: simCtx }) };
};
const byId = (host: HTMLElement, id: string): Element => {
  const el = host.querySelector(`[id="${id}"]`);
  if (el === null) throw new Error(`no element ${id}`);
  return el;
};
const text = (): string => "item";

describe("k.aria: roles", () => {
  test('`option` renders `<li role="option" aria-selected="false">`', () => {
    const { host, off } = render(() => Part({ id: "x", role: "option", selected: false, children: text }));
    const el = byId(host, "x");
    expect(el.tagName).toBe("LI");
    expect(el.getAttribute("role")).toBe("option");
    expect(el.getAttribute("aria-selected")).toBe("false");
    off();
  });

  test('`tab` renders a `<button type="button" role="tab">`', () => {
    const { host, off } = render(() => Part({ id: "x", role: "tab", selected: false, controls: "p", children: text }));
    const el = byId(host, "x");
    expect(el.tagName).toBe("BUTTON");
    expect(el.getAttribute("type")).toBe("button");
    expect(el.getAttribute("role")).toBe("tab");
    off();
  });

  test('`columnheader` renders a `<th scope="col">` without a `role` attribute', () => {
    const { host, off } = render(() => Part({ id: "x", role: "columnheader", sort: "ascending", children: text }));
    const el = byId(host, "x");
    expect(el.tagName).toBe("TH");
    expect(el.getAttribute("scope")).toBe("col");
    expect(el.hasAttribute("role")).toBe(false);
    off();
  });

  test("`dialog` renders a `<dialog>` without a `role` attribute", () => {
    const { host, off } = render(() => Part({ id: "x", role: "dialog", labelledBy: "h", open: false, children: text }));
    const el = byId(host, "x");
    expect(el.tagName).toBe("DIALOG");
    expect(el.hasAttribute("role")).toBe(false);
    off();
  });

  // Implicit roles per HTML-AAM: ul list, li listitem, input[type=text] textbox, div generic, nav navigation,
  // dialog dialog, tbody/thead rowgroup, tr row, th[scope=col] columnheader, th[scope=row] rowheader, td cell.
  type Case = { name: string; make: () => Node; tag: string; role: string | null; extra?: Record<string, string> };
  const cases: Case[] = [
    {
      name: "listbox",
      make: () => Part({ id: "x", role: "listbox", label: "L", children: text }),
      tag: "UL",
      role: "listbox",
    },
    { name: "menu", make: () => Part({ id: "x", role: "menu", label: "M", children: text }), tag: "UL", role: "menu" },
    {
      name: "option",
      make: () => Part({ id: "x", role: "option", selected: false, children: text }),
      tag: "LI",
      role: "option",
    },
    { name: "menuitem", make: () => Part({ id: "x", role: "menuitem", children: text }), tag: "LI", role: "menuitem" },
    {
      name: "menuitemcheckbox",
      make: () => Part({ id: "x", role: "menuitemcheckbox", checked: false, children: text }),
      tag: "LI",
      role: "menuitemcheckbox",
    },
    {
      name: "combobox",
      make: () => Part({ id: "x", role: "combobox", label: "C", expanded: false, controls: "p" }),
      tag: "INPUT",
      role: "combobox",
      extra: { type: "text", "aria-autocomplete": "list" },
    },
    {
      name: "button",
      make: () => Part({ id: "x", role: "button", controls: "p", children: text }),
      tag: "BUTTON",
      role: null,
      extra: { type: "button" },
    },
    {
      name: "checkbox",
      make: () => Part({ id: "x", role: "checkbox", label: "C", checked: false }),
      tag: "INPUT",
      role: null,
      extra: { type: "checkbox" },
    },
    {
      name: "tablist",
      make: () => Part({ id: "x", role: "tablist", label: "T", children: text }),
      tag: "DIV",
      role: "tablist",
    },
    {
      name: "tab",
      make: () => Part({ id: "x", role: "tab", selected: false, controls: "p", children: text }),
      tag: "BUTTON",
      role: "tab",
      extra: { type: "button" },
    },
    {
      name: "tabpanel",
      make: () => Part({ id: "x", role: "tabpanel", labelledBy: "t", children: text }),
      tag: "DIV",
      role: "tabpanel",
    },
    {
      name: "alertdialog",
      make: () =>
        Part({ id: "x", role: "alertdialog", labelledBy: "h", open: false, describedBy: "d", children: text }),
      tag: "DIALOG",
      role: "alertdialog",
    },
    { name: "status", make: () => Part({ id: "x", role: "status", children: text }), tag: "DIV", role: "status" },
    { name: "alert", make: () => Part({ id: "x", role: "alert", children: text }), tag: "DIV", role: "alert" },
    { name: "generic", make: () => Part({ id: "x", role: "generic", children: text }), tag: "DIV", role: null },
    {
      name: "navigation",
      make: () => Part({ id: "x", role: "navigation", label: "N", children: text }),
      tag: "NAV",
      role: null,
    },
    {
      name: "group",
      make: () => Part({ id: "x", role: "group", label: "G", children: text }),
      tag: "DIV",
      role: "group",
    },
    {
      name: "table",
      make: () => Part({ id: "x", role: "table", label: "T", rowCount: 1, children: text }),
      tag: "TABLE",
      role: null,
    },
    { name: "rowgroup", make: () => Part({ id: "x", role: "rowgroup", children: text }), tag: "TBODY", role: null },
    { name: "row", make: () => Part({ id: "x", role: "row", rowIndex: 1, children: text }), tag: "TR", role: null },
    {
      name: "rowheader",
      make: () => Part({ id: "x", role: "rowheader", children: text }),
      tag: "TH",
      role: null,
      extra: { scope: "row" },
    },
    { name: "cell", make: () => Part({ id: "x", role: "cell", colSpan: 1, children: text }), tag: "TD", role: null },
  ];

  test("each role renders its table tag, and writes `role` only where it differs from the tag's implicit role", () => {
    fc.assert(
      fc.property(fc.constantFrom(...cases), (c) => {
        const { host, off } = render(c.make);
        const el = byId(host, "x");
        expect(el.tagName).toBe(c.tag);
        if (c.role === null) expect(el.hasAttribute("role")).toBe(false);
        else expect(el.getAttribute("role")).toBe(c.role);
        for (const [k, v] of Object.entries(c.extra ?? {})) expect(el.getAttribute(k)).toBe(v);
        off();
        host.remove();
      }),
      { seed: SEED, numRuns: cases.length * 2 },
    );
  });

  test("`rowgroup` renders `tbody`, and `thead` with `head`", () => {
    const body = render(() => Part({ id: "x", role: "rowgroup", children: text }));
    expect(byId(body.host, "x").tagName).toBe("TBODY");
    const head = render(() => Part({ id: "y", role: "rowgroup", head: true, children: text }));
    expect(byId(head.host, "y").tagName).toBe("THEAD");
    body.off();
    head.off();
  });

  test("`rowheader` renders `th scope=row` and `cell` renders `td`, neither with a `role` attribute", () => {
    const { host, off } = render(() => Part({ id: "x", role: "rowheader", children: text }));
    expect(byId(host, "x").getAttribute("scope")).toBe("row");
    expect(byId(host, "x").hasAttribute("role")).toBe(false);
    off();
  });

  test("`checkbox` takes `checked` of `true`, `false` or `'mixed'` and `button` takes `hasPopup` of `menu`, `listbox` or `dialog`", () => {
    const states: Of<"checkbox">["checked"][] = [true, false, "mixed"];
    expect(states).toHaveLength(3);
    for (const popup of ["menu", "listbox", "dialog"] as const) {
      const { host, off } = render(() =>
        Part({ id: "x", role: "button", controls: "p", hasPopup: popup, children: text }),
      );
      expect(byId(host, "x").getAttribute("aria-haspopup")).toBe(popup);
      off();
    }
  });

  test("`role` fixes the ARIA props `Part` accepts: a prop another role takes is a type error", () => {
    expectTypeOf<Of<"option">>().toHaveProperty("selected");
    expectTypeOf<Of<"option">>().not.toHaveProperty("checked");
    expectTypeOf<Of<"option">>().not.toHaveProperty("expanded");
    expectTypeOf<Of<"combobox">>().toHaveProperty("expanded");
    expectTypeOf<Of<"combobox">>().not.toHaveProperty("selected");
    expectTypeOf<Of<"checkbox">>().toHaveProperty("checked");
    expectTypeOf<Of<"checkbox">>().not.toHaveProperty("controls");
    expectTypeOf<Of<"tab">>().toHaveProperty("controls");
    expectTypeOf<Of<"tabpanel">>().toHaveProperty("labelledBy");
    expectTypeOf<Of<"tabpanel">>().not.toHaveProperty("label");
    expectTypeOf<Of<"row">>().toHaveProperty("rowIndex");
    expectTypeOf<Of<"table">>().toHaveProperty("rowCount");
    expectTypeOf<Of<"row">>().not.toHaveProperty("rowCount");
    expect(true).toBe(true);
  });
});
