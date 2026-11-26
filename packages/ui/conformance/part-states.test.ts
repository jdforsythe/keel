// @vitest-environment happy-dom
// Spec: k.aria, clause "With `brandTokens`, a `button` `Part` with `pressed` from a signal and `states={{ pressed: { bg: 'accent' } }}` has the `accent` rule under `[aria-pressed=\"true\"]` in the CSS file, and setting the signal true changes only its `aria-pressed` attribute."
// Spec: k.aria, clause "With `brandTokens`, `states={{ disabled: { fg: 'textSecondary' } }}` puts its rule under both `:disabled` and `[aria-disabled=\"true\"]`, so a `menuitemradio` with `disabled` true matches it; `states={{ current: { weight: 'bold' } }}` matches a `gridcell` with `current: 'date'` and not one with `current` false."
// Spec: k.aria, clause "`states={{ pressed: { bg: 'accent' } }}` on a base element `Button` is a type error, asserted by `tsc --noEmit` over `conformance/`, which the package's `check` script runs (`vitest run` does not type-check)."
// Spec: k.aria, clause "There, on `Part` and in a `look` or `base` set, `states` takes every state below; on a base element, the first four. Each state's rule matches any of its selectors:" (the states table: `hover`, `focusVisible`, `active` `:hover`, `:focus-visible`, `:active`; `disabled` `:disabled`, `[aria-disabled=\"true\"]`; `selected` `[aria-selected=\"true\"]`; `checked` `[aria-checked=\"true\"]`, `:checked`; `pressed` `[aria-pressed=\"true\"]`; `expanded` `[aria-expanded=\"true\"]`; `current` `[aria-current]:not([aria-current=\"false\"])`; `highlighted` `[data-k-highlighted]`)
// Seed: 1337 (fc.assert below).
// The CSS half runs the compiler's collection (`compile`) into `compileStyles`, as packages/compiler/conformance/part-styles.test.ts and aria-states-css.test.ts do for `highlighted`; the DOM half asserts that each emitted selector matches the element the spec names, by `Element.matches` in happy-dom.
// The type case is asserted by `tsc --noEmit` over `conformance/` (packages/ui/tsconfig.json includes `conformance`; the `check` script runs `tsc --noEmit && biome check src test`). "A type error" (the last clause) is asserted with `expectTypeOf` on the `states` key set, which `tsc` judges; vitest at run time cannot fail it (no `@ts-expect-error` is used).
// ASSUMPTIONS: a usage under `pressed`, `current` or `disabled` is `{ props, state }` as the other states are; the state names are the table's. "The `accent` rule under `[aria-pressed=\"true\"]`" is the class rule `.<c>[aria-pressed="true"]`.
import { compile } from "@keel/compiler";
import { Part } from "@keel/ui/aria";
import { Button } from "@keel/ui";
import { brandTokens } from "@keel/ui/brand";
import { compileStyles } from "@keel/ui/css";
import fc from "fast-check";
import { afterEach, describe, expect, expectTypeOf, test } from "vitest";
import { cssEscape } from "./fixtures.ts";
import { SEED, byId, cleanup, flush, render, signal } from "./roles-support.ts";

afterEach(cleanup);
const text = (): string => "x";

const TABLE = {
  hover: [":hover"],
  focusVisible: [":focus-visible"],
  active: [":active"],
  disabled: [":disabled", '[aria-disabled="true"]'],
  selected: ['[aria-selected="true"]'],
  checked: ['[aria-checked="true"]', ":checked"],
  pressed: ['[aria-pressed="true"]'],
  expanded: ['[aria-expanded="true"]'],
  current: ['[aria-current]:not([aria-current="false"])'],
  highlighted: ["[data-k-highlighted]"],
} as const;
type State = keyof typeof TABLE;
const STATES: State[] = [
  "hover",
  "focusVisible",
  "active",
  "disabled",
  "selected",
  "checked",
  "pressed",
  "expanded",
  "current",
  "highlighted",
];

/** The selector list the rule of `cls` carries in `css`: the text from `.cls` to its `{`, split at top-level commas. */
function selectorsOf(css: string, cls: string): string[] {
  const out: string[] = [];
  let from = 0;
  const needle = `.${cssEscape(cls)}`;
  for (;;) {
    const at = css.indexOf(needle, from);
    if (at < 0) return out;
    const open = css.indexOf("{", at);
    const start = Math.max(css.lastIndexOf("}", at), css.lastIndexOf("{", at)) + 1;
    out.push(
      ...css
        .slice(start, open)
        .split(/,(?![^(]*\))/)
        .map((x) => x.trim())
        .filter((x) => x.includes(needle)),
    );
    from = open;
  }
}
const matchesAny = (el: Element, selectors: string[]): boolean => selectors.some((sel) => el.matches(sel));

describe("k.aria: one states table in the CSS file", () => {
  test("each state's rule matches any of its selectors, for every state of the table", () => {
    fc.assert(
      fc.property(fc.constantFrom(...STATES), fc.integer({ min: 1, max: 3 }), (state, times) => {
        const usage = { props: { bg: "accent" }, state } as const;
        const { classes, css } = compileStyles({
          tokens: brandTokens,
          usages: Array.from({ length: times }, () => usage),
        });
        const cls = classes[0] ?? [];
        expect(cls.length).toBeGreaterThan(0);
        for (const c of cls) {
          for (const sel of TABLE[state]) expect(css, `${state}: ${sel}`).toContain(`.${cssEscape(c)}${sel}`);
        }
      }),
      { seed: SEED, numRuns: 40 },
    );
  });
});

describe("k.aria: pressed", () => {
  const SOURCE = `import { signal } from "@keel/reactive";
import { Part } from "@keel/ui/aria";
export default function Toggle() {
  const on = signal(false);
  return <Part id="t.b" role="button" pressed={on} states={{ pressed: { bg: 'accent' } }}>x</Part>;
}`;

  test("With `brandTokens`, a `button` `Part` with `pressed` from a signal and `states={{ pressed: { bg: 'accent' } }}` has the `accent` rule under `[aria-pressed=\"true\"]` in the CSS file", () => {
    const r = compile([{ path: "Toggle.tsx", source: SOURCE }]);
    expect(r.diagnostics).toEqual([]);
    const usages = r.artifacts["styles.json"].usages.filter((u) => u.state === "pressed");
    expect(usages.filter((u) => u.props.bg === "accent")).toHaveLength(1);
    const { classes, css } = compileStyles({
      tokens: brandTokens,
      usages: [{ props: { bg: "accent" }, state: "pressed" }],
    });
    for (const c of classes[0] ?? []) expect(css).toContain(`.${cssEscape(c)}[aria-pressed="true"]`);
  });

  test("setting the signal true changes only its `aria-pressed` attribute", async () => {
    const on = signal(false);
    const { host, off } = render(() => Part({ id: "b", role: "button", pressed: on, children: text }));
    const el = byId(host, "b");
    const before = Object.fromEntries(Array.from(el.attributes, (a) => [a.name, a.value]));
    expect(before["aria-pressed"]).toBe("false");
    on.set(true);
    await flush();
    const after = Object.fromEntries(Array.from(el.attributes, (a) => [a.name, a.value]));
    expect(byId(host, "b")).toBe(el);
    expect({ ...after, "aria-pressed": "false" }).toEqual(before);
    expect(after["aria-pressed"]).toBe("true");
    expect(el.matches('[aria-pressed="true"]')).toBe(true);
    off();
  });

  test('whatever the sequence of toggles, `[aria-pressed="true"]` matches the button exactly while the signal is true', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.boolean(), { minLength: 1, maxLength: 6 }), async (seq) => {
        const on = signal(false);
        const { host, off } = render(() => Part({ id: "b", role: "button", pressed: on, children: text }));
        for (const v of seq) {
          on.set(v);
          await flush();
          expect(byId(host, "b").matches('[aria-pressed="true"]')).toBe(v);
        }
        off();
        cleanup();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });
});

describe("k.aria: disabled, current and checked match their elements", () => {
  const ruleFor = (state: State) => {
    const { classes, css } = compileStyles({
      tokens: brandTokens,
      usages: [{ props: { fg: "textSecondary" }, state }],
    });
    const cls = (classes[0] ?? [])[0] ?? "";
    expect(cls).not.toBe("");
    return { cls, selectors: selectorsOf(css, cls) };
  };

  test("With `brandTokens`, `states={{ disabled: { fg: 'textSecondary' } }}` puts its rule under both `:disabled` and `[aria-disabled=\"true\"]`, so a `menuitemradio` with `disabled` true matches it", () => {
    const { cls, selectors } = ruleFor("disabled");
    expect(selectors.some((s) => s.endsWith(":disabled"))).toBe(true);
    expect(selectors.some((s) => s.endsWith('[aria-disabled="true"]'))).toBe(true);
    const { host, off } = render(() =>
      Part({ id: "m", role: "menuitemradio", checked: false, disabled: true, children: text }),
    );
    const el = byId(host, "m");
    el.classList.add(cls);
    expect(el.getAttribute("aria-disabled")).toBe("true");
    expect(matchesAny(el, selectors)).toBe(true);
    off();
  });

  test("a `menuitemradio` that is not disabled, and a native `button` that is, match as the table says", () => {
    const { cls, selectors } = ruleFor("disabled");
    const a = render(() => Part({ id: "m", role: "menuitemradio", checked: false, disabled: false, children: text }));
    const m = byId(a.host, "m");
    m.classList.add(cls);
    expect(matchesAny(m, selectors)).toBe(false);
    a.off();
    const b = render(() => Part({ id: "b", role: "button", disabled: true, children: text }));
    const btn = byId(b.host, "b");
    btn.classList.add(cls);
    expect(matchesAny(btn, selectors)).toBe(true);
    b.off();
  });

  test("`states={{ current: { weight: 'bold' } }}` matches a `gridcell` with `current: 'date'` and not one with `current` false", () => {
    const { cls, selectors } = ruleFor("current");
    expect(selectors.some((s) => s.endsWith('[aria-current]:not([aria-current="false"])'))).toBe(true);
    for (const [value, expected] of [
      ["date", true],
      [true, true],
      [false, false],
    ] as const) {
      const r = render(() => Part({ id: "g", role: "gridcell", current: value, children: text }));
      const el = byId(r.host, "g");
      el.classList.add(cls);
      expect(matchesAny(el, selectors), String(value)).toBe(expected);
      r.off();
    }
    const none = render(() => Part({ id: "g", role: "gridcell", children: text }));
    const el = byId(none.host, "g");
    el.classList.add(cls);
    expect(matchesAny(el, selectors)).toBe(false);
    none.off();
  });

  test("`checked` matches a `switch` and a `menuitemradio` that are on, and neither when off", () => {
    const { cls, selectors } = ruleFor("checked");
    for (const role of ["switch", "menuitemradio"] as const) {
      for (const checked of [true, false]) {
        const r = render(() =>
          role === "switch"
            ? Part({ id: "c", role, label: "Wifi", checked, children: text })
            : Part({ id: "c", role, checked, children: text }),
        );
        const el = byId(r.host, "c");
        el.classList.add(cls);
        expect(matchesAny(el, selectors), `${role} ${checked}`).toBe(checked);
        r.off();
      }
    }
  });
});

describe("k.aria: a base element's states", () => {
  test("`states={{ pressed: { bg: 'accent' } }}` on a base element `Button` is a type error: its `states` has no `pressed`, and `Part`'s has", () => {
    type ButtonStates = NonNullable<Parameters<typeof Button>[0]["states"]>;
    type PartStates = NonNullable<Extract<Parameters<typeof Part>[0], { role: "button" }>["states"]>;
    expectTypeOf<"pressed">().not.toExtend<keyof ButtonStates>();
    expectTypeOf<"current">().not.toExtend<keyof ButtonStates>();
    expectTypeOf<"pressed">().toExtend<keyof PartStates>();
    expectTypeOf<"current">().toExtend<keyof PartStates>();
    expect(true).toBe(true); // `tsc` judges the claims above; there is nothing to fail at run time.
  });
});
