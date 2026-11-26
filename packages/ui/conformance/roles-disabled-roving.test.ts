// @vitest-environment happy-dom
// Keys (k.roles): "`toolbar` and `menubar` are one tab stop: one item has `tabIndex` 0 and the rest -1, and `onKey` moves `focus` with ArrowRight to the next item and ArrowLeft to the previous, the two swapped where the group's computed `direction` is `rtl` (ArrowDown to the next and ArrowUp to the previous when `orientation` is `vertical`), and Home and End to the first and last. In a `menubar`, ArrowDown, Enter or Space on a `menuitem` with `hasPopup` opens its `menu` and Escape closes it, focus back on the item. A disabled item keeps its place in the order and takes focus: a `button` or `switch` `Part` given `tabIndex` writes `disabled` as `aria-disabled` and not the HTML attribute, and its `onClick` is not called while it is disabled."
// Spec: k.roles, clause "A `button` `Part` with `tabIndex` -1 and `disabled` true renders with `aria-disabled=\"true\"` and no `disabled` attribute, `focus` turning true focuses it, and `fire(id, 'click')` calls no `onClick`; without `tabIndex` it writes the `disabled` attribute as k.aria says."
// Seed: 1337 (fc.assert below).
// `fire` is the @keel/testing harness call (packages/testing/conformance/roles-harness.test.ts); here `click` and `keydown` events are dispatched on the element, the path `fire` takes.
// Keel writes each role's states and the keys are the component's own (k.roles Keys): the arrow cases below run a component's `onKey` that reads the group's computed `direction`, and assert Keel gives it that value and carries its `focus` and `tabIndex`. That a component moves ArrowLeft to the previous item in `ltr` and to the next in `rtl` is the component's code, not Keel's; the case is the clause's documented pattern.
// Untestable here: Space and Enter on a native button synthesize a `click` in a browser, not in happy-dom; the cases dispatch `click`. Whether a computed `direction` follows `dir="rtl"` through a browser's style resolution is the platform's; the host's `style.direction` is set and read back.
import { Part } from "@keel/ui/aria";
import fc from "fast-check";
import { afterEach, describe, expect, test } from "vitest";
import { SEED, byId, cleanup, computed, flush, render, signal } from "./roles-support.ts";

afterEach(cleanup);
const text = (): string => "x";
const keydown = (el: Element, key: string): KeyboardEvent => {
  const ev = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  el.dispatchEvent(ev);
  return ev;
};

describe("k.roles: a disabled roving item stays focusable", () => {
  for (const role of ["button", "switch"] as const) {
    test(`a \`${role}\` \`Part\` with \`tabIndex\` -1 and \`disabled\` true renders with \`aria-disabled="true"\` and no \`disabled\` attribute, \`focus\` turning true focuses it, and \`fire(id, 'click')\` calls no \`onClick\`; without \`tabIndex\` it writes the \`disabled\` attribute`, async () => {
      let clicks = 0;
      const bump = (): void => {
        clicks += 1;
      };
      const focus = signal(false);
      const { host } = render(() =>
        role === "button"
          ? Part({
              id: "b",
              role: "button",
              tabIndex: -1,
              disabled: true,
              focus,
              onClick: bump,
              children: text,
            })
          : Part({
              id: "b",
              role: "switch",
              label: "Wifi",
              checked: false,
              tabIndex: -1,
              disabled: true,
              focus,
              onClick: bump,
              children: text,
            }),
      );
      const el = byId(host, "b");
      expect(el.getAttribute("aria-disabled")).toBe("true");
      expect(el.hasAttribute("disabled")).toBe(false);
      expect(el.getAttribute("tabindex")).toBe("-1");
      focus.set(true);
      await flush();
      expect(document.activeElement).toBe(el);
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await flush();
      expect(clicks).toBe(0);

      const plain = render(() =>
        role === "button"
          ? Part({ id: "p", role: "button", disabled: true, onClick: bump, children: text })
          : Part({
              id: "p",
              role: "switch",
              label: "Wifi",
              checked: false,
              disabled: true,
              onClick: bump,
              children: text,
            }),
      );
      const p = byId(plain.host, "p");
      expect(p.hasAttribute("disabled")).toBe(true);
      expect(p.hasAttribute("aria-disabled")).toBe(false);
    });

    test(`a \`${role}\` \`Part\` with \`tabIndex\` and \`disabled\` false writes no \`aria-disabled\` and calls \`onClick\` on a click`, async () => {
      let clicks = 0;
      const bump = (): void => {
        clicks += 1;
      };
      const { host } = render(() =>
        role === "button"
          ? Part({
              id: "b",
              role: "button",
              tabIndex: 0,
              disabled: false,
              onClick: bump,
              children: text,
            })
          : Part({
              id: "b",
              role: "switch",
              label: "Wifi",
              checked: false,
              tabIndex: 0,
              disabled: false,
              onClick: bump,
              children: text,
            }),
      );
      const el = byId(host, "b");
      expect(el.hasAttribute("aria-disabled")).toBe(false);
      expect(el.hasAttribute("disabled")).toBe(false);
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await flush();
      expect(clicks).toBe(1);
    });
  }

  test("a `disabled` signal flipped from true to false on a roving `button` removes `aria-disabled` and lets `onClick` run, and back to true restores both", async () => {
    let clicks = 0;
    const bump = (): void => {
      clicks += 1;
    };
    const off = signal(true);
    const { host } = render(() =>
      Part({ id: "b", role: "button", tabIndex: 0, disabled: off, onClick: bump, children: text }),
    );
    const el = byId(host, "b");
    const click = (): void => void el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(el.getAttribute("aria-disabled")).toBe("true");
    click();
    expect(clicks).toBe(0);
    off.set(false);
    await flush();
    expect(el.hasAttribute("aria-disabled")).toBe(false);
    click();
    expect(clicks).toBe(1);
    off.set(true);
    await flush();
    expect(el.getAttribute("aria-disabled")).toBe("true");
    click();
    expect(clicks).toBe(1);
  });

  test("in a toolbar whose roving `onKey` moves over every item, a disabled item keeps its place in the order, takes focus, writes `aria-disabled` and runs no `onClick`, whatever the item's index", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 5 }), fc.nat({ max: 4 }), async (n, pick) => {
        const dead = pick % n;
        const active = signal(0);
        const clicks: number[] = [];
        const { host, off } = render(() =>
          Part({
            id: "t",
            role: "toolbar",
            label: "T",
            onKey: (k) => {
              if (k.key === "ArrowRight") active.set((active.get() + 1) % n);
              else if (k.key === "ArrowLeft") active.set((active.get() + n - 1) % n);
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
                  disabled: i === dead,
                  onClick: () => void clicks.push(i),
                  children: () => String(i),
                }),
              ),
          }),
        );
        const order = Array.from(host.querySelectorAll("button")).map((b) => b.id);
        expect(order).toEqual(Array.from({ length: n }, (_, i) => `t.b${i}`));
        for (let step = 0; step < n; step++) {
          const at = active.get();
          keydown(byId(host, `t.b${at}`), "ArrowRight");
          await flush();
        }
        // after n steps every item, the disabled one among them, has been active
        keydown(byId(host, `t.b${active.get()}`), "ArrowRight");
        active.set(dead);
        await flush();
        const el = byId(host, `t.b${dead}`);
        expect(document.activeElement).toBe(el);
        expect(el.getAttribute("aria-disabled")).toBe("true");
        expect(el.hasAttribute("disabled")).toBe(false);
        expect(el.getAttribute("tabindex")).toBe("0");
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        expect(clicks).toEqual([]);
        for (let i = 0; i < n; i++) {
          if (i !== dead) expect(byId(host, `t.b${i}`).hasAttribute("aria-disabled")).toBe(false);
        }
        off();
      }),
      { seed: SEED, numRuns: 10 },
    );
  });
});

describe("k.roles: arrows follow the group's computed direction", () => {
  const arrows = (rtl: boolean): { next: string; prev: string } =>
    rtl ? { next: "ArrowLeft", prev: "ArrowRight" } : { next: "ArrowRight", prev: "ArrowLeft" };

  test('a toolbar whose `onKey` reads its element\'s computed `direction` moves to the next item on ArrowLeft under `dir="rtl"` and on ArrowRight under `ltr`, and to the previous on the other, Home and End unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        fc.integer({ min: 2, max: 5 }),
        fc.array(fc.constantFrom("ArrowRight", "ArrowLeft", "Home", "End"), { minLength: 1, maxLength: 6 }),
        async (rtl, n, keys) => {
          const active = signal(0);
          const { host, off } = render(() => {
            const bar = Part({
              id: "t",
              role: "toolbar",
              label: "T",
              onKey: (k) => {
                const dir = getComputedStyle(byId(host, "t")).direction;
                const map = arrows(dir === "rtl");
                if (k.key === map.next) active.set((active.get() + 1) % n);
                else if (k.key === map.prev) active.set((active.get() + n - 1) % n);
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
            });
            return bar;
          });
          host.setAttribute("dir", rtl ? "rtl" : "ltr");
          host.style.direction = rtl ? "rtl" : "ltr";
          expect(getComputedStyle(byId(host, "t")).direction).toBe(rtl ? "rtl" : "ltr");
          let model = 0;
          for (const key of keys) {
            keydown(byId(host, `t.b${model}`), key);
            const map = arrows(rtl);
            model =
              key === map.next
                ? (model + 1) % n
                : key === map.prev
                  ? (model + n - 1) % n
                  : key === "Home"
                    ? 0
                    : key === "End"
                      ? n - 1
                      : model;
            await flush();
            expect(byId(host, `t.b${model}`).getAttribute("tabindex")).toBe("0");
            expect(Array.from(host.querySelectorAll("[tabindex='0']")).map((e) => e.id)).toEqual([`t.b${model}`]);
          }
          off();
        },
      ),
      { seed: SEED, numRuns: 12 },
    );
  });
});
