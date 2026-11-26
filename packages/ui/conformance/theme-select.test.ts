// @vitest-environment happy-dom
// Spec: k.schemes, clause "With `choice` themes `slate` and `forest`, `<ThemeSelect id=\"theme\" label=\"Theme\" labels={{ default: 'Keel', slate: 'Slate', forest: 'Forest' }} />` renders a `select` with option values `default`, `slate`, `forest`, value `default` and no axe violations; after `fire('theme', { type: 'change', value: 'slate' })` `<html>` has `data-k-theme=\"slate\"` and `document.cookie` holds `keel-theme=slate`, and after `value: 'default'` neither."
// Spec: k.schemes, clause "Under a sim ctx with a theme `slate`, `appearance(ctx).set({ theme: 'slate' })` returns `true`, then `appearance(ctx).theme()` is `slate`, `<html>` has `data-k-theme=\"slate\"` and a computed reading `theme()` has run again; `set({ theme: 'nope' })` returns `false` and changes neither."
// Seed: 1337 (fc.assert below). No `test.skip`: the cases are plain tests and fail until RFC 0249 is built.
// ASSUMPTIONS: `ThemeSelect`'s options come from its `labels` keys in the order given (`default` first), the app's `choice` themes in `themes` order, which E1816 holds equal (packages/check/conformance/theme-select-e1816.test.ts); the control has no other source of theme names in this file. The picks go through `fire`'s path: `value` set on the `select`, a bubbling `change` dispatched (scheme-select.test.ts). The cookie written by a pick is `keel-theme=<name>; Path=/; Max-Age=31536000; SameSite=Lax`, "likewise" with SchemeSelect, and `default` writes `keel-theme=; Path=/; Max-Age=0; SameSite=Lax`, read through the write log (logCookieWrites).
// AMBIGUOUS (k.schemes Choice): "`set({ scheme?, theme? })` ... returns `false` with no change for a theme no option names": the spec does not say how a sim ctx learns the app's themes. The reading asserted: the options of the `ThemeSelect` rendered in the harness document name them (`default`, `slate`), and no `ThemeSelect` rendered means no option names any theme.
// `appearance(ctx)` is read as `appearance(ctx).theme()` inside a computed, which the reactive layer reruns when the pick changes (k.schemes: "reactive `scheme()` ... and `theme()`").
// Needs a real browser: the first paint and the system preference are packages/server/conformance/theme-cookie.test.ts and end-to-end cases.
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { ThemeSelect, appearance } from "@keel/ui";
import axe from "axe-core";
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { SEED, byId, cleanup, computed, flush, logCookieWrites, render } from "./roles-support.ts";

const LABELS = { default: "Keel", slate: "Slate", forest: "Forest" } as const;
const select = () => ThemeSelect({ id: "theme", label: "Theme", labels: LABELS });
const root = document.documentElement;
const reset = (): void => {
  root.removeAttribute("data-k-theme");
  document.cookie = "keel-theme=; Path=/; Max-Age=0";
};
beforeEach(reset);
afterEach(() => {
  cleanup();
  reset();
});
const change = (el: HTMLElement, value: string): void => {
  if (!(el instanceof HTMLSelectElement)) throw new Error("fixture: not a select");
  el.value = value;
  el.dispatchEvent(new Event("change", { bubbles: true }));
};
const EXPIRED = "keel-theme=; Path=/; Max-Age=0; SameSite=Lax";

describe("k.schemes: ThemeSelect", () => {
  test("With `choice` themes `slate` and `forest`, `<ThemeSelect id=\"theme\" label=\"Theme\" labels={{ default: 'Keel', slate: 'Slate', forest: 'Forest' }} />` renders a `select` with option values `default`, `slate`, `forest` and value `default`", () => {
    const { host, off } = render(select);
    const el = byId(host, "theme");
    expect(el.tagName).toBe("SELECT");
    expect(Array.from(el.querySelectorAll("option"), (o) => o.value)).toEqual(["default", "slate", "forest"]);
    expect(Array.from(el.querySelectorAll("option"), (o) => o.textContent)).toEqual(["Keel", "Slate", "Forest"]);
    expect(el instanceof HTMLSelectElement && el.value).toBe("default");
    expect(el.classList.contains("k-control")).toBe(true);
    off();
  });

  test("its value is `<html>`'s `data-k-theme` when it names an option, else `default`", () => {
    for (const [attr, want] of [
      ["slate", "slate"],
      ["forest", "forest"],
      ["nope", "default"],
    ] as const) {
      root.setAttribute("data-k-theme", attr);
      const { host, off } = render(select);
      const el = byId(host, "theme");
      expect(el instanceof HTMLSelectElement && el.value).toBe(want);
      off();
      cleanup();
    }
  });

  test("the options are `default` then the themes `labels` names in order, with the words `labels` gives, whatever the names", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.stringMatching(/^[a-z][a-z0-9]{0,8}$/), { minLength: 1, maxLength: 5 }),
        (names) => {
          fc.pre(!names.some((n) => ["default", "system", "light", "dark"].includes(n)));
          const labels = Object.fromEntries([["default", "Keel"], ...names.map((n) => [n, n.toUpperCase()])]);
          const { host, off } = render(() => ThemeSelect({ id: "theme", label: "Theme", labels }));
          const options = Array.from(byId(host, "theme").querySelectorAll("option"));
          expect(options.map((o) => o.value)).toEqual(["default", ...names]);
          expect(options.map((o) => o.textContent)).toEqual(["Keel", ...names.map((n) => n.toUpperCase())]);
          off();
          cleanup();
        },
      ),
      { seed: SEED, numRuns: 15 },
    );
  });

  test("it has no axe violations", async () => {
    document.documentElement.setAttribute("lang", "en");
    document.head.innerHTML = "<title>Conformance</title>";
    document.body.innerHTML = '<main><div id="host"></div></main>';
    const container = document.getElementById("host");
    if (container === null) throw new Error("no host");
    const off = mount(select, container, { ctx: createCtx({ mode: "sim", seed: SEED }) });
    expect(container.querySelector("select")).not.toBeNull();
    const r = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
      rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
    });
    off();
    document.body.innerHTML = "";
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });

  test("after `fire('theme', { type: 'change', value: 'slate' })` `<html>` has `data-k-theme=\"slate\"` and `document.cookie` holds `keel-theme=slate`, and after `value: 'default'` neither", async () => {
    const { host, off } = render(select);
    const log = logCookieWrites();
    try {
      change(byId(host, "theme"), "slate");
      await flush();
      expect(root.getAttribute("data-k-theme")).toBe("slate");
      expect(document.cookie).toContain("keel-theme=slate");
      expect(log.writes.at(-1)).toBe("keel-theme=slate; Path=/; Max-Age=31536000; SameSite=Lax");
      change(byId(host, "theme"), "default");
      await flush();
      expect(root.hasAttribute("data-k-theme")).toBe(false);
      expect(log.writes.at(-1)).toBe(EXPIRED);
    } finally {
      log.stop();
    }
    off();
  });

  test("whatever sequence of picks came before, the last pick is `<html>`'s `data-k-theme` and the cookie's last write, and `default` removes both", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom("default", "slate", "forest"), { minLength: 1, maxLength: 6 }),
        async (picks) => {
          const { host, off } = render(select);
          const log = logCookieWrites();
          try {
            for (const p of picks) {
              change(byId(host, "theme"), p);
              await flush();
            }
            const last = picks[picks.length - 1];
            if (last === "default") {
              expect(root.hasAttribute("data-k-theme")).toBe(false);
              expect(log.writes.at(-1)).toBe(EXPIRED);
            } else {
              expect(root.getAttribute("data-k-theme")).toBe(last);
              expect(log.writes.at(-1)).toContain(`keel-theme=${last}`);
            }
          } finally {
            log.stop();
          }
          off();
          cleanup();
          reset();
        },
      ),
      { seed: SEED, numRuns: 15 },
    );
  });
});

describe("k.schemes: appearance(ctx)", () => {
  const ctx = () => createCtx({ mode: "sim", seed: SEED });

  test("Under a sim ctx with a theme `slate`, `appearance(ctx).set({ theme: 'slate' })` returns `true`, then `appearance(ctx).theme()` is `slate`, `<html>` has `data-k-theme=\"slate\"` and a computed reading `theme()` has run again; `set({ theme: 'nope' })` returns `false` and changes neither", async () => {
    const { off } = render(() =>
      ThemeSelect({ id: "theme", label: "Theme", labels: { default: "Keel", slate: "Slate" } }),
    );
    const c = ctx();
    const a = appearance(c);
    let runs = 0;
    const seen = computed(() => {
      runs++;
      return appearance(c).theme();
    });
    expect(seen.get()).toBe("default");
    const before = runs;
    expect(a.set({ theme: "slate" })).toBe(true);
    await flush();
    expect(appearance(c).theme()).toBe("slate");
    expect(root.getAttribute("data-k-theme")).toBe("slate");
    expect(seen.get()).toBe("slate");
    expect(runs).toBeGreaterThan(before);
    const after = runs;
    expect(a.set({ theme: "nope" })).toBe(false);
    await flush();
    expect(appearance(c).theme()).toBe("slate");
    expect(root.getAttribute("data-k-theme")).toBe("slate");
    expect(runs).toBe(after);
    off();
  });

  test("`set({ scheme })` writes `data-k-scheme` as a pick does, `scheme()` reads `system`, `light` or `dark`, and `set({ theme: 'default' })` removes `data-k-theme`", async () => {
    const { off } = render(() =>
      ThemeSelect({ id: "theme", label: "Theme", labels: { default: "Keel", slate: "Slate" } }),
    );
    const a = appearance(ctx());
    expect(a.scheme()).toBe("system");
    expect(a.set({ scheme: "dark", theme: "slate" })).toBe(true);
    await flush();
    expect(a.scheme()).toBe("dark");
    expect(root.getAttribute("data-k-scheme")).toBe("dark");
    expect(a.set({ theme: "default" })).toBe(true);
    await flush();
    expect(a.theme()).toBe("default");
    expect(root.hasAttribute("data-k-theme")).toBe(false);
    expect(a.set({ scheme: "system" })).toBe(true);
    await flush();
    expect(root.hasAttribute("data-k-scheme")).toBe(false);
    off();
    root.removeAttribute("data-k-scheme");
  });

  test("a theme no option names returns `false` with no change, whatever the name", () => {
    const { off } = render(() =>
      ThemeSelect({ id: "theme", label: "Theme", labels: { default: "Keel", slate: "Slate" } }),
    );
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z][a-z0-9]{0,10}$/), (name) => {
        fc.pre(name !== "slate" && name !== "default");
        expect(appearance(ctx()).set({ theme: name })).toBe(false);
        expect(root.hasAttribute("data-k-theme")).toBe(false);
      }),
      { seed: SEED, numRuns: 25 },
    );
    off();
  });
});
