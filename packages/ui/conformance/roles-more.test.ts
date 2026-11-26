// @vitest-environment happy-dom
// Spec: k.roles, clause "A `switch` with `label=\"Wifi\"` and `checked` false renders `<button type=\"button\" role=\"switch\" aria-checked=\"false\" aria-label=\"Wifi\">`; `fire(id, 'click')` calls `onClick` once, and a signal bound to `checked` set true changes only `aria-checked` to `\"true\"`."
// Spec: k.roles, clause "A `button` with `pressed` true writes `aria-pressed=\"true\"`, and with `describedBy=\"t\"` writes `aria-describedby=\"t\"`; without them it writes neither."
// Spec: k.roles, clause "`toolbar` renders a `<div role=\"toolbar\" aria-label=...>`, `menubar` a `<ul role=\"menubar\" aria-label=...>`, `menuitemradio` with `checked` true an `<li role=\"menuitemradio\" aria-checked=\"true\">`, and a `menuitem` with `hasPopup=\"menu\"` and `expanded` false writes `aria-haspopup=\"menu\" aria-expanded=\"false\"`."
// Spec: k.roles, clause "A `meter` with `label=\"Disk\"`, `min` 0, `max` 100 and `value` 40 renders `<meter min=\"0\" max=\"100\" value=\"40\" aria-label=\"Disk\">` with no `role` attribute; a `progressbar` with `value` undefined renders a `<progress>` with no `value` attribute."
// Spec: k.roles, clause "A `region` with `label=\"Details\"` renders `<section aria-label=\"Details\">` with no `role` attribute."
// Spec: k.roles, clause "A `switch`, a `toolbar` holding two `button`s, a `menubar` with one `menuitem`, a `meter`, a `progressbar` and a `region` each have no axe violations."
// k.roles, Keys: the keys are the component's own and no check judges them; the cases here show `Part` carries a component's roving focus (`tabIndex`, `focus`, `onKey`) on `toolbar` and `menubar` items.
// Seed: 1337 (fc.assert below).
// `fire` is the @keel/testing harness call (packages/testing/conformance/roles-harness.test.ts); here `click` and `keydown` events are dispatched on the element, the path `fire` takes.
// Untestable here: Space and Enter on a native button synthesize a `click` in a browser, not in happy-dom; the cases dispatch `click`.
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { Part } from "@keel/ui/aria";
import axe from "axe-core";
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, expectTypeOf, test } from "vitest";
import { SEED, byId, cleanup, computed, flush, render, signal } from "./roles-support.ts";

afterEach(cleanup);
type PartProps = Parameters<typeof Part>[0];
const text = (): string => "x";

const keydown = (el: Element, key: string): KeyboardEvent => {
  const ev = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  el.dispatchEvent(ev);
  return ev;
};

describe("k.roles: switch and toggle button", () => {
  test('a `switch` with `label="Wifi"` and `checked` false renders `<button type="button" role="switch" aria-checked="false" aria-label="Wifi">`', () => {
    const { host, off } = render(() =>
      Part({ id: "w", role: "switch", label: "Wifi", checked: false, children: text }),
    );
    const el = byId(host, "w");
    expect(el.tagName).toBe("BUTTON");
    expect(el.getAttribute("type")).toBe("button");
    expect(el.getAttribute("role")).toBe("switch");
    expect(el.getAttribute("aria-checked")).toBe("false");
    expect(el.getAttribute("aria-label")).toBe("Wifi");
    off();
  });

  test('a `switch` always writes `role="switch"` and `aria-checked` as `"true"` or `"false"`, whatever its label', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.stringMatching(/^[A-Za-z]{1,12}$/), (checked, label) => {
        const { host, off } = render(() => Part({ id: "w", role: "switch", label, checked, children: text }));
        const el = byId(host, "w");
        expect(el.getAttribute("role")).toBe("switch");
        expect(el.getAttribute("aria-checked")).toBe(String(checked));
        expect(el.getAttribute("aria-label")).toBe(label);
        off();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("`fire(id, 'click')` on a `switch` calls `onClick` once", () => {
    let calls = 0;
    const { host, off } = render(() =>
      Part({ id: "w", role: "switch", label: "Wifi", checked: false, onClick: () => calls++, children: text }),
    );
    byId(host, "w").click();
    expect(calls).toBe(1);
    off();
  });

  test('a signal bound to a `switch`\'s `checked` set true changes only `aria-checked` to `"true"`', async () => {
    const on = signal(false);
    const { host, off } = render(() =>
      Part({ id: "w", role: "switch", label: "Wifi", checked: on, describedBy: "w.hint", children: text }),
    );
    const el = byId(host, "w");
    const before = Array.from(el.attributes, (a) => [a.name, a.value]).filter(([n]) => n !== "aria-checked");
    on.set(true);
    await flush();
    expect(byId(host, "w")).toBe(el);
    expect(el.getAttribute("aria-checked")).toBe("true");
    expect(Array.from(el.attributes, (a) => [a.name, a.value]).filter(([n]) => n !== "aria-checked")).toEqual(before);
    off();
  });

  test("a `switch` takes `disabled` (the HTML attribute, no `aria-disabled`) and `describedBy` (`aria-describedby`)", () => {
    const { host, off } = render(() =>
      Part({ id: "w", role: "switch", label: "Wifi", checked: true, disabled: true, describedBy: "h", children: text }),
    );
    const el = byId(host, "w");
    expect(el.hasAttribute("disabled")).toBe(true);
    expect(el.hasAttribute("aria-disabled")).toBe(false);
    expect(el.getAttribute("aria-describedby")).toBe("h");
    off();
  });

  test("types: a `switch` needs `label` or `labelledBy`, and `checked`", () => {
    expectTypeOf<{ id: string; role: "switch"; label: string; checked: boolean }>().toMatchTypeOf<PartProps>();
    expectTypeOf<{ id: string; role: "switch"; label: string }>().not.toMatchTypeOf<PartProps>();
    expectTypeOf<{ id: string; role: "switch"; checked: boolean }>().not.toMatchTypeOf<PartProps>();
    expect(true).toBe(true);
  });

  test('a `button` with `pressed` true writes `aria-pressed="true"`, and with `describedBy="t"` writes `aria-describedby="t"`', () => {
    const { host, off } = render(() =>
      Part({ id: "b", role: "button", pressed: true, describedBy: "t", children: text }),
    );
    expect(byId(host, "b").getAttribute("aria-pressed")).toBe("true");
    expect(byId(host, "b").getAttribute("aria-describedby")).toBe("t");
    off();
  });

  test('`pressed` false writes `aria-pressed="false"`', () => {
    const { host, off } = render(() => Part({ id: "b", role: "button", pressed: false, children: text }));
    expect(byId(host, "b").getAttribute("aria-pressed")).toBe("false");
    off();
  });

  test("a `button` without `pressed` and `describedBy` writes neither", () => {
    const { host, off } = render(() => Part({ id: "b", role: "button", children: text }));
    expect(byId(host, "b").hasAttribute("aria-pressed")).toBe(false);
    expect(byId(host, "b").hasAttribute("aria-describedby")).toBe(false);
    off();
  });

  test("a click on a toggle `button` calls `onClick`, where the component flips `pressed`; a signal bound to `pressed` changes `aria-pressed`", async () => {
    const pressed = signal(false);
    const { host, off } = render(() =>
      Part({ id: "b", role: "button", pressed, onClick: () => pressed.set(!pressed.get()), children: text }),
    );
    const el = byId(host, "b");
    expect(el.getAttribute("aria-pressed")).toBe("false");
    el.click();
    await flush();
    expect(el.getAttribute("aria-pressed")).toBe("true");
    el.click();
    await flush();
    expect(el.getAttribute("aria-pressed")).toBe("false");
    off();
  });
});

describe("k.roles: toolbar, menubar, menuitemradio, menuitem", () => {
  test('`toolbar` renders a `<div role="toolbar" aria-label=...>`', () => {
    const { host, off } = render(() => Part({ id: "t", role: "toolbar", label: "Format", children: text }));
    const el = byId(host, "t");
    expect(el.tagName).toBe("DIV");
    expect(el.getAttribute("role")).toBe("toolbar");
    expect(el.getAttribute("aria-label")).toBe("Format");
    off();
  });

  test('`menubar` renders a `<ul role="menubar" aria-label=...>`', () => {
    const { host, off } = render(() => Part({ id: "m", role: "menubar", label: "App", children: text }));
    const el = byId(host, "m");
    expect(el.tagName).toBe("UL");
    expect(el.getAttribute("role")).toBe("menubar");
    expect(el.getAttribute("aria-label")).toBe("App");
    off();
  });

  test('`menuitemradio` with `checked` true an `<li role="menuitemradio" aria-checked="true">`', () => {
    const { host, off } = render(() => Part({ id: "r", role: "menuitemradio", checked: true, children: text }));
    const el = byId(host, "r");
    expect(el.tagName).toBe("LI");
    expect(el.getAttribute("role")).toBe("menuitemradio");
    expect(el.getAttribute("aria-checked")).toBe("true");
    off();
  });

  test('a `menuitem` with `hasPopup="menu"` and `expanded` false writes `aria-haspopup="menu" aria-expanded="false"`', () => {
    const { host, off } = render(() =>
      Part({ id: "i", role: "menuitem", hasPopup: "menu", expanded: false, children: text }),
    );
    expect(byId(host, "i").getAttribute("aria-haspopup")).toBe("menu");
    expect(byId(host, "i").getAttribute("aria-expanded")).toBe("false");
    off();
  });

  test("a `menuitem` without `hasPopup` and `expanded` writes neither", () => {
    const { host, off } = render(() => Part({ id: "i", role: "menuitem", children: text }));
    expect(byId(host, "i").hasAttribute("aria-haspopup")).toBe(false);
    expect(byId(host, "i").hasAttribute("aria-expanded")).toBe(false);
    off();
  });

  test("`orientation` on `toolbar` and `menubar` writes `aria-orientation`; `activeDescendant` on `menubar` writes `aria-activedescendant`; `disabled` on `menuitemradio` writes `aria-disabled`, not `disabled`", () => {
    const { host, off } = render(() =>
      Part({
        id: "all",
        role: "generic",
        children: () => [
          Part({ id: "t", role: "toolbar", label: "T", orientation: "vertical", children: text }),
          Part({
            id: "m",
            role: "menubar",
            label: "M",
            orientation: "horizontal",
            activeDescendant: "m.a",
            children: text,
          }),
          Part({ id: "r", role: "menuitemradio", checked: false, disabled: true, children: text }),
        ],
      }),
    );
    expect(byId(host, "t").getAttribute("aria-orientation")).toBe("vertical");
    expect(byId(host, "m").getAttribute("aria-orientation")).toBe("horizontal");
    expect(byId(host, "m").getAttribute("aria-activedescendant")).toBe("m.a");
    expect(byId(host, "r").getAttribute("aria-disabled")).toBe("true");
    expect(byId(host, "r").hasAttribute("disabled")).toBe(false);
    expect(byId(host, "r").getAttribute("aria-checked")).toBe("false");
    off();
  });

  test("types: `toolbar` and `menubar` need `label` or `labelledBy`, `menuitemradio` needs `checked`; `pressed` is no prop of `region`", () => {
    expectTypeOf<{ id: string; role: "toolbar"; label: string }>().toMatchTypeOf<PartProps>();
    expectTypeOf<{ id: string; role: "toolbar" }>().not.toMatchTypeOf<PartProps>();
    expectTypeOf<{ id: string; role: "menubar"; label: string }>().toMatchTypeOf<PartProps>();
    expectTypeOf<{ id: string; role: "menubar" }>().not.toMatchTypeOf<PartProps>();
    expectTypeOf<{ id: string; role: "menuitemradio"; checked: boolean }>().toMatchTypeOf<PartProps>();
    expectTypeOf<{ id: string; role: "menuitemradio" }>().not.toMatchTypeOf<PartProps>();
    expectTypeOf<{ id: string; role: "region"; label: string; pressed: boolean }>().not.toMatchTypeOf<PartProps>();
    expect(true).toBe(true);
  });

  test('a toolbar is one tab stop: with `tabIndex` and `focus` from a signal and `onKey` moving it, ArrowRight and ArrowLeft, Home and End move focus and leave one item with `tabindex="0"`', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        fc.array(fc.constantFrom("ArrowRight", "ArrowLeft", "Home", "End"), { minLength: 1, maxLength: 8 }),
        async (n, keys) => {
          const active = signal(0);
          const { host, off } = render(() =>
            Part({
              id: "t",
              role: "toolbar",
              label: "T",
              onKey: (k) => {
                const at = active.get();
                if (k.key === "ArrowRight") active.set((at + 1) % n);
                else if (k.key === "ArrowLeft") active.set((at + n - 1) % n);
                else if (k.key === "Home") active.set(0);
                else if (k.key === "End") active.set(n - 1);
                else return false;
                return true;
              },
              children: () =>
                Array.from({ length: n }, (_, i) =>
                  Part({
                    id: `t.b${i}`,
                    role: "button",
                    tabIndex: computed(() => (active.get() === i ? 0 : -1)),
                    focus: computed(() => active.get() === i),
                    children: () => String(i),
                  }),
                ),
            }),
          );
          let model = 0;
          for (const key of keys) {
            const ev = keydown(byId(host, `t.b${model}`), key);
            expect(ev.defaultPrevented).toBe(true);
            model =
              key === "ArrowRight"
                ? (model + 1) % n
                : key === "ArrowLeft"
                  ? (model + n - 1) % n
                  : key === "Home"
                    ? 0
                    : n - 1;
            await flush();
            const stops = Array.from({ length: n }, (_, i) => byId(host, `t.b${i}`)).filter(
              (b) => b.getAttribute("tabindex") === "0",
            );
            expect(stops.map((b) => b.id)).toEqual([`t.b${model}`]);
            expect(document.activeElement?.id).toBe(`t.b${model}`);
          }
          off();
        },
      ),
      { seed: SEED, numRuns: 10 },
    );
  });

  test("in a menubar, ArrowDown on a `menuitem` with `hasPopup` reaches the component's `onKey`, which sets `expanded`; Escape sets it false", async () => {
    const open = signal(false);
    const { host, off } = render(() =>
      Part({
        id: "m",
        role: "menubar",
        label: "App",
        children: () =>
          Part({
            id: "m.file",
            role: "menuitem",
            hasPopup: "menu",
            expanded: open,
            onKey: (k) => {
              if (k.key === "ArrowDown" || k.key === "Enter" || k.key === " ") open.set(true);
              else if (k.key === "Escape") open.set(false);
              else return false;
              return true;
            },
            children: text,
          }),
      }),
    );
    const item = byId(host, "m.file");
    expect(item.getAttribute("aria-expanded")).toBe("false");
    keydown(item, "ArrowDown");
    await flush();
    expect(item.getAttribute("aria-expanded")).toBe("true");
    keydown(item, "Escape");
    await flush();
    expect(item.getAttribute("aria-expanded")).toBe("false");
    off();
  });
});

describe("k.roles: meter, progressbar, region", () => {
  test('a `meter` with `label="Disk"`, `min` 0, `max` 100 and `value` 40 renders `<meter min="0" max="100" value="40" aria-label="Disk">` with no `role` attribute', () => {
    const { host, off } = render(() =>
      Part({ id: "d", role: "meter", label: "Disk", min: 0, max: 100, value: 40, children: text }),
    );
    const el = byId(host, "d");
    expect(el.tagName).toBe("METER");
    expect(el.getAttribute("min")).toBe("0");
    expect(el.getAttribute("max")).toBe("100");
    expect(el.getAttribute("value")).toBe("40");
    expect(el.getAttribute("aria-label")).toBe("Disk");
    expect(el.hasAttribute("role")).toBe(false);
    off();
  });

  test("a `meter` writes `low`, `high`, `optimum` and `valueText` (`aria-valuetext`) as given, and any `min`, `max` and `value` as numbers", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 50 }), fc.integer({ min: 60, max: 200 }), (min, max) => {
        const value = min + 1;
        const { host, off } = render(() =>
          Part({
            id: "d",
            role: "meter",
            label: "Disk",
            min,
            max,
            value,
            low: min + 2,
            high: max - 2,
            optimum: max - 1,
            valueText: "forty",
            children: text,
          }),
        );
        const el = byId(host, "d");
        expect(el.getAttribute("min")).toBe(String(min));
        expect(el.getAttribute("max")).toBe(String(max));
        expect(el.getAttribute("value")).toBe(String(value));
        expect(el.getAttribute("low")).toBe(String(min + 2));
        expect(el.getAttribute("high")).toBe(String(max - 2));
        expect(el.getAttribute("optimum")).toBe(String(max - 1));
        expect(el.getAttribute("aria-valuetext")).toBe("forty");
        off();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("a `meter` without `low`, `high`, `optimum` and `valueText` writes none of them", () => {
    const { host, off } = render(() =>
      Part({ id: "d", role: "meter", label: "Disk", min: 0, max: 1, value: 1, children: text }),
    );
    for (const a of ["low", "high", "optimum", "aria-valuetext"]) expect(byId(host, "d").hasAttribute(a)).toBe(false);
    off();
  });

  test("a `progressbar` with `value` undefined renders a `<progress>` with no `value` attribute", () => {
    const { host, off } = render(() =>
      Part({ id: "p", role: "progressbar", label: "Upload", value: undefined, children: text }),
    );
    const el = byId(host, "p");
    expect(el.tagName).toBe("PROGRESS");
    expect(el.hasAttribute("value")).toBe(false);
    expect(el.hasAttribute("role")).toBe(false);
    off();
  });

  test("a `progressbar` with `value` and `max` writes both, and `valueText` writes `aria-valuetext`", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (v) => {
        const { host, off } = render(() =>
          Part({ id: "p", role: "progressbar", label: "Upload", value: v, max: 100, valueText: "x%", children: text }),
        );
        const el = byId(host, "p");
        expect(el.getAttribute("value")).toBe(String(v));
        expect(el.getAttribute("max")).toBe("100");
        expect(el.getAttribute("aria-valuetext")).toBe("x%");
        off();
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  test("`meter` and `progressbar` take no focus: neither writes a `tabindex`", () => {
    const { host, off } = render(() =>
      Part({
        id: "all",
        role: "generic",
        children: () => [
          Part({ id: "d", role: "meter", label: "D", min: 0, max: 1, value: 1, children: text }),
          Part({ id: "p", role: "progressbar", label: "P", value: 1, children: text }),
        ],
      }),
    );
    expect(byId(host, "d").hasAttribute("tabindex")).toBe(false);
    expect(byId(host, "p").hasAttribute("tabindex")).toBe(false);
    off();
  });

  test('a `region` with `label="Details"` renders `<section aria-label="Details">` with no `role` attribute', () => {
    const { host, off } = render(() => Part({ id: "r", role: "region", label: "Details", children: text }));
    const el = byId(host, "r");
    expect(el.tagName).toBe("SECTION");
    expect(el.getAttribute("aria-label")).toBe("Details");
    expect(el.hasAttribute("role")).toBe(false);
    off();
  });
});

describe("k.roles: new roles have no axe violations", () => {
  const DISABLED = [
    "region",
    "landmark-one-main",
    "page-has-heading-one",
    "landmark-no-duplicate-main",
    "landmark-unique",
    "landmark-complementary-is-top-level",
    "landmark-main-is-top-level",
    "landmark-banner-is-top-level",
    "landmark-contentinfo-is-top-level",
    "bypass",
    "skip-link",
    "color-contrast",
  ];
  const config: axe.RunOptions = {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
    rules: Object.fromEntries(DISABLED.map((id) => [id, { enabled: false }])),
  };
  let container: HTMLElement;
  beforeEach(() => {
    document.documentElement.setAttribute("lang", "en");
    document.head.innerHTML = "<title>Conformance</title>";
    document.body.innerHTML = '<main><div id="host"></div></main>';
    const h = document.getElementById("host");
    if (h === null) throw new Error("no host");
    container = h;
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });
  const audit = async (make: () => Node): Promise<string[]> => {
    const off = mount(make, container, { ctx: createCtx({ mode: "sim", seed: 1337 }) });
    const r = await axe.run(container, config);
    off();
    return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(" | ")}`);
  };

  test("a `switch`, a `toolbar` holding two `buttons`, a `menubar` with one `menuitem`, a `meter`, a `progressbar` and a `region` each have no axe violations", async () => {
    const btn = (id: string): Node => Part({ id, role: "button", children: () => "Bold" });
    const cases: [string, () => Node][] = [
      ["switch", () => Part({ id: "w", role: "switch", label: "Wifi", checked: false, children: () => "Wifi" })],
      [
        "toolbar",
        () =>
          Part({
            id: "t",
            role: "toolbar",
            label: "Format",
            children: () => [btn("t.a"), Part({ id: "t.b", role: "button", children: () => "Italic" })],
          }),
      ],
      [
        "menubar",
        () =>
          Part({
            id: "m",
            role: "menubar",
            label: "App",
            children: () => Part({ id: "m.i", role: "menuitem", children: () => "File" }),
          }),
      ],
      ["meter", () => Part({ id: "d", role: "meter", label: "Disk", min: 0, max: 100, value: 40, children: text })],
      ["progressbar", () => Part({ id: "p", role: "progressbar", label: "Upload", value: 3, max: 10, children: text })],
      ["region", () => Part({ id: "r", role: "region", label: "Details", children: () => "Body" })],
    ];
    for (const [name, make] of cases) expect([name, await audit(make)]).toEqual([name, []]);
  });
});
