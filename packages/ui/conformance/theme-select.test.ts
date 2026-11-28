// @vitest-environment happy-dom
// Spec: k.schemes, clause "`render` with `artifacts: { tokens }` holding `choice` themes `slate` and `forest`, of `<ThemeSelect id=\"theme\" label=\"Theme\" labels={{ default: 'Keel', slate: 'Slate' }} />` gives a `select` with option values `default`, `slate`, `forest`, texts `Keel`, `Slate`, `forest`, value `default` and no axe violations; after `fire('theme', { type: 'change', value: 'slate' })` `<html>` has `data-k-theme=\"slate\"` and `document.cookie` holds `keel-theme=slate`, and after `value: 'default'` neither."
// Spec: k.schemes, clause "With `ctx` a sim ctx given to a `render` whose tokens hold a theme `slate`, `appearance(ctx).set({ theme: 'slate' })` is `true`, then `theme()` is `slate`, `<html>` has `data-k-theme=\"slate\"` and a computed reading `theme()` has run again; `set({ theme: 'nope' })` is `false` and changes neither; so is `set({ theme: 'slate' })` on a sim ctx given to no render."
// Seed: 1337 (fc.assert below). No `test.skip`: the cases are plain tests and fail until RFC 0249 is built.
// The harness `render` (roles-support.ts) is given `artifacts: { tokens }` and, where a case reads the ctx, the ctx: `ThemeSelect`'s options come from the tokens (`default`, then each `choice` theme in `themes` order; the text from `labels` under the name, else the name), and a sim ctx knows the themes of the render it is given to. The picks go through `fire`'s path: `value` set on the `select`, a bubbling `change` dispatched (scheme-select.test.ts). The cookie a pick writes is `keel-theme=<name>; Path=/; Max-Age=31536000; SameSite=Lax`, "likewise" with SchemeSelect, and `default` writes `keel-theme=; Path=/; Max-Age=0; SameSite=Lax`, read through the write log (logCookieWrites).
// `appearance(ctx).theme()` is read inside a computed, which the reactive layer reruns when the pick changes (k.schemes: "reactive `scheme()` ... and `theme()`"). "No document" for a ctx given to no render is read as: `set` returns `false` and `<html>` is untouched.
// Needs a real browser: the first paint and the system preference are packages/server/conformance/theme-cookie.test.ts and end-to-end cases.
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { ThemeSelect, appearance } from "@keel/ui";
import axe from "axe-core";
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { withGroups } from "./base-support.ts";
import { SEED, byId, cleanup, computed, flush, logCookieWrites, render } from "./roles-support.ts";

const themed = (names: readonly string[]) =>
  withGroups({ themes: Object.fromEntries(names.map((n) => [n, { color: { fg: "#222222" } }])) });
const tokens = () => themed(["slate", "forest"]);
const LABELS = { default: "Keel", slate: "Slate" } as const;
const select = () => ThemeSelect({ id: "theme", label: "Theme", labels: LABELS });
const root = document.documentElement;
const reset = (): void => {
  root.removeAttribute("data-k-theme");
  root.removeAttribute("data-k-scheme");
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
const given = () => ({ artifacts: { tokens: tokens() } });

describe("k.schemes: ThemeSelect", () => {
  test("`render` with `artifacts: { tokens }` holding `choice` themes `slate` and `forest`, of `<ThemeSelect id=\"theme\" label=\"Theme\" labels={{ default: 'Keel', slate: 'Slate' }} />` gives a `select` with option values `default`, `slate`, `forest`, texts `Keel`, `Slate`, `forest`, value `default`", () => {
    const { host, off } = render(select, given());
    const el = byId(host, "theme");
    expect(el.tagName).toBe("SELECT");
    const options = Array.from(el.querySelectorAll("option"));
    expect(options.map((o) => o.value)).toEqual(["default", "slate", "forest"]);
    expect(options.map((o) => o.textContent)).toEqual(["Keel", "Slate", "forest"]);
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
      const { host, off } = render(select, given());
      const el = byId(host, "theme");
      expect(el instanceof HTMLSelectElement && el.value).toBe(want);
      off();
      cleanup();
    }
  });

  test("the options are `default` then the `choice` themes of the tokens in `themes` order, each text `labels` under its name else the name, whatever the themes", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.stringMatching(/^[a-z][a-z0-9]{0,8}$/), { minLength: 1, maxLength: 5 }),
        fc.boolean(),
        (names, labelled) => {
          fc.pre(!names.some((n) => ["default", "system", "light", "dark"].includes(n)));
          const labels = Object.fromEntries([
            ["default", "Keel"],
            ...(labelled ? names.map((n) => [n, n.toUpperCase()]) : []),
          ]);
          const { host, off } = render(() => ThemeSelect({ id: "theme", label: "Theme", labels }), {
            artifacts: { tokens: themed(names) },
          });
          const options = Array.from(byId(host, "theme").querySelectorAll("option"));
          expect(options.map((o) => o.value)).toEqual(["default", ...names]);
          expect(options.map((o) => o.textContent)).toEqual([
            "Keel",
            ...names.map((n) => (labelled ? n.toUpperCase() : n)),
          ]);
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
    const options = { ctx: createCtx({ mode: "sim", seed: SEED }), artifacts: { tokens: tokens() } };
    const off = mount(select, container, options);
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
    const { host, off } = render(select, given());
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
          const { host, off } = render(select, given());
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

  test("With `ctx` a sim ctx given to a `render` whose tokens hold a theme `slate`, `appearance(ctx).set({ theme: 'slate' })` is `true`, then `theme()` is `slate`, `<html>` has `data-k-theme=\"slate\"` and a computed reading `theme()` has run again; `set({ theme: 'nope' })` is `false` and changes neither", async () => {
    const c = ctx();
    const { off } = render(select, { artifacts: { tokens: tokens() }, ctx: c });
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

  test("`set({ theme: 'slate' })` on a sim ctx given to no render is `false` and changes nothing: the ctx knows no theme and has no document", async () => {
    const a = appearance(ctx());
    expect(a.set({ theme: "slate" })).toBe(false);
    await flush();
    expect(root.hasAttribute("data-k-theme")).toBe(false);
    expect(a.theme()).toBe("default");
  });

  test("`set({ scheme })` writes `data-k-scheme` as a pick does, `scheme()` reads `system`, `light` or `dark`, and `set({ theme: 'default' })` removes `data-k-theme`", async () => {
    const c = ctx();
    const { off } = render(select, { artifacts: { tokens: tokens() }, ctx: c });
    const a = appearance(c);
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
  });

  test("a theme no option names returns `false` with no change, whatever the name", () => {
    const c = ctx();
    const { off } = render(select, { artifacts: { tokens: tokens() }, ctx: c });
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z][a-z0-9]{0,10}$/), (name) => {
        fc.pre(name !== "slate" && name !== "forest" && name !== "default");
        expect(appearance(c).set({ theme: name })).toBe(false);
        expect(root.hasAttribute("data-k-theme")).toBe(false);
      }),
      { seed: SEED, numRuns: 25 },
    );
    off();
  });
});
