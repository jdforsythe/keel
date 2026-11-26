// @vitest-environment happy-dom
// Spec: k.schemes, clause "`<SchemeSelect id=\"scheme\" label=\"Scheme\" labels={{ system: 'System', light: 'Light', dark: 'Dark' }} />` renders a `select` with options of values `system`, `light`, `dark` and texts `System`, `Light`, `Dark`, value `system`, with no axe violations."
// Spec: k.schemes, clause "After `fire('scheme', { type: 'change', value: 'dark' })`, `document.documentElement` has `data-k-scheme=\"dark\"` and `document.cookie` holds `keel-scheme=dark`; after `fire('scheme', { type: 'change', value: 'system' })`, it has no `data-k-scheme` and `document.cookie` holds no `keel-scheme`."
// k.schemes, Choice: `SchemeSelect` renders as `Select` does with the options `system`, `light`, `dark` in that order, `labels`, exactly one of `label` and `labelledBy` (E1802), role class `k-control`, and `id`; picking `light` or `dark` writes `keel-scheme=<value>; Path=/; Max-Age=31536000; SameSite=Lax` (`; Secure` on https); picking `system` removes the attribute and writes `keel-scheme=; Path=/; Max-Age=0; SameSite=Lax`.
// Seed: 1337 (fc.assert below).
// `fire(id, { type: 'change', value })` is the @keel/testing harness call; here `value` is set on the `select` and a bubbling `change` event is dispatched, the path `fire` takes.
// ASSUMPTIONS: happy-dom's `document.cookie` setter stores the pair and drops it at `Max-Age=0`; the full cookie string with its attributes is not readable back, so the attributes are asserted through a spy on the cookie setter. Whether the `Secure` attribute follows `https` is read through `location.protocol`; happy-dom's location is `about:blank` here, so the `Secure` half is untestable in this file and needs the end-to-end case.
// Needs a real browser: the first paint from the cookie and the system preference are packages/server/conformance/scheme-cookie.test.ts and an end-to-end case.
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { Box, SchemeSelect } from "@keel/ui";
import axe from "axe-core";
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { SEED, byId, cleanup, flush, render } from "./roles-support.ts";

const LABELS = { system: "System", light: "Light", dark: "Dark" } as const;
const select = () => SchemeSelect({ id: "scheme", label: "Scheme", labels: LABELS });

const root = document.documentElement;
const clearCookie = (): void => {
  document.cookie = "keel-scheme=; Path=/; Max-Age=0";
};
beforeEach(() => {
  root.removeAttribute("data-k-scheme");
  clearCookie();
});
afterEach(() => {
  cleanup();
  root.removeAttribute("data-k-scheme");
  clearCookie();
});

const change = (el: HTMLElement, value: string): void => {
  if (!(el instanceof HTMLSelectElement)) throw new Error("fixture: not a select");
  el.value = value;
  el.dispatchEvent(new Event("change", { bubbles: true }));
};

describe("k.schemes: SchemeSelect", () => {
  test("`<SchemeSelect id=\"scheme\" label=\"Scheme\" labels={{ system: 'System', light: 'Light', dark: 'Dark' }} />` renders a `select` with options of values `system`, `light`, `dark` and texts `System`, `Light`, `Dark`, value `system`", () => {
    const { host, off } = render(select);
    const el = byId(host, "scheme");
    expect(el.tagName).toBe("SELECT");
    const options = Array.from(el.querySelectorAll("option"));
    expect(options.map((o) => o.value)).toEqual(["system", "light", "dark"]);
    expect(options.map((o) => o.textContent)).toEqual(["System", "Light", "Dark"]);
    expect(el instanceof HTMLSelectElement && el.value).toBe("system");
    expect(el.classList.contains("k-control")).toBe(true);
    off();
  });

  test("the option texts are whatever `labels` gives, in the order `system`, `light`, `dark`", () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.stringMatching(/^[A-Za-z]{1,10}$/), { minLength: 3, maxLength: 3 }), (words) => {
        const [system = "", light = "", dark = ""] = words;
        const { host, off } = render(() =>
          SchemeSelect({ id: "scheme", label: "Scheme", labels: { system, light, dark } }),
        );
        expect(Array.from(byId(host, "scheme").querySelectorAll("option"), (o) => o.textContent)).toEqual([
          system,
          light,
          dark,
        ]);
        off();
      }),
      { seed: SEED, numRuns: 15 },
    );
  });

  test("its value is `<html>`'s `data-k-scheme` when it holds one, else `system`", () => {
    for (const v of ["light", "dark"]) {
      root.setAttribute("data-k-scheme", v);
      const { host, off } = render(select);
      const el = byId(host, "scheme");
      expect(el instanceof HTMLSelectElement && el.value).toBe(v);
      off();
    }
  });

  test("named by `label` it has an accessible name, and with `labelledBy` instead it is named by that element", () => {
    const { host, off } = render(() =>
      Box({
        id: "all",
        children: () => [
          SchemeSelect({ id: "a", label: "Scheme", labels: LABELS }),
          SchemeSelect({ id: "b", labelledBy: "title", labels: LABELS }),
        ],
      }),
    );
    expect(byId(host, "a").getAttribute("aria-label") ?? byId(host, "a").closest("label")?.textContent).toBeTruthy();
    expect(byId(host, "b").getAttribute("aria-labelledby")).toBe("title");
    off();
  });

  test("it has no axe violations", async () => {
    document.documentElement.setAttribute("lang", "en");
    document.head.innerHTML = "<title>Conformance</title>";
    document.body.innerHTML = '<main><div id="host"></div></main>';
    const container = document.getElementById("host");
    if (container === null) throw new Error("no host");
    const off = mount(select, container, { ctx: createCtx({ mode: "sim", seed: 1337 }) });
    expect(container.querySelector("select")).not.toBeNull();
    const r = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
      rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
    });
    off();
    document.body.innerHTML = "";
    expect(r.violations.map((v) => v.id)).toEqual([]);
  });
});

describe("k.schemes: picking", () => {
  test("after `fire('scheme', { type: 'change', value: 'dark' })`, `document.documentElement` has `data-k-scheme=\"dark\"` and `document.cookie` holds `keel-scheme=dark`; after `fire('scheme', { type: 'change', value: 'system' })`, it has no `data-k-scheme` and `document.cookie` holds no `keel-scheme`", async () => {
    const { host, off } = render(select);
    change(byId(host, "scheme"), "dark");
    await flush();
    expect(root.getAttribute("data-k-scheme")).toBe("dark");
    expect(document.cookie).toContain("keel-scheme=dark");
    change(byId(host, "scheme"), "system");
    await flush();
    expect(root.hasAttribute("data-k-scheme")).toBe(false);
    expect(document.cookie).not.toContain("keel-scheme");
    off();
  });

  test("picking `light` or `dark` sets `data-k-scheme` to it and writes the cookie, whatever sequence of picks came before", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom("system", "light", "dark"), { minLength: 1, maxLength: 6 }),
        async (picks) => {
          const { host, off } = render(select);
          for (const p of picks) {
            change(byId(host, "scheme"), p);
            await flush();
          }
          const last = picks[picks.length - 1];
          if (last === "system") {
            expect(root.hasAttribute("data-k-scheme")).toBe(false);
            expect(document.cookie).not.toContain("keel-scheme");
          } else {
            expect(root.getAttribute("data-k-scheme")).toBe(last);
            expect(document.cookie).toContain(`keel-scheme=${last}`);
          }
          off();
          cleanup();
          root.removeAttribute("data-k-scheme");
          clearCookie();
        },
      ),
      { seed: SEED, numRuns: 15 },
    );
  });

  test("a pick writes `keel-scheme=<value>; Path=/; Max-Age=31536000; SameSite=Lax`, and `system` writes `keel-scheme=; Path=/; Max-Age=0; SameSite=Lax`", async () => {
    const written: string[] = [];
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(document), "cookie");
    const seen = (v: string): void => {
      written.push(v);
    };
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => "",
      set: seen,
    });
    try {
      const { host, off } = render(select);
      change(byId(host, "scheme"), "light");
      await flush();
      change(byId(host, "scheme"), "system");
      await flush();
      off();
    } finally {
      Reflect.deleteProperty(document, "cookie");
      if (descriptor !== undefined) Object.defineProperty(Object.getPrototypeOf(document), "cookie", descriptor);
    }
    expect(written).toContain("keel-scheme=light; Path=/; Max-Age=31536000; SameSite=Lax");
    expect(written).toContain("keel-scheme=; Path=/; Max-Age=0; SameSite=Lax");
  });
});
