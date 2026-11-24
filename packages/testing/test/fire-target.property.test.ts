// @vitest-environment happy-dom
// Spec: k.testing Harness: `keydown` goes to the document's focused element (focus moved to a focusable `id` first,
// E1719 for an unfocusable one with focus outside it); `change` with `value` is a pick in a single `<select>`
// (`input` then `change`, nothing for the option already selected, E1726 otherwise).
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const log: string[] = [];
const idOf = (t: EventTarget | null): string => (t instanceof Element ? t.id : "?");
const on = (el: HTMLElement, id: string): HTMLElement => {
  el.id = id;
  el.dataset.k = id;
  for (const type of ["keydown", "focus", "blur", "input", "change"])
    el.addEventListener(type, (e) => {
      if (e.target === el || type === "keydown" || type === "input" || type === "change")
        log.push(`${type}:${id}@${idOf(e.target)}`);
    });
  return el;
};

// `wrap` (unfocusable) holds the input `inner`; `x` and `y` are inputs; `p` is unfocusable; `pick` a select of
// `o0`..`o3` with `o3` disabled.
const View = Object.assign(
  (): Node => {
    const root = on(document.createElement("div"), "root");
    const wrap = on(document.createElement("div"), "wrap");
    const inner = on(document.createElement("input"), "inner");
    inner.setAttribute("aria-label", "Inner");
    wrap.append(inner);
    const x = on(document.createElement("input"), "x");
    x.setAttribute("aria-label", "X");
    const y = on(document.createElement("input"), "y");
    y.setAttribute("aria-label", "Y");
    const p = on(document.createElement("p"), "p");
    p.textContent = "text";
    const pick = on(document.createElement("select"), "pick");
    pick.setAttribute("aria-label", "Pick");
    for (const v of ["o0", "o1", "o2", "o3"]) {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      o.disabled = v === "o3";
      pick.append(o);
    }
    root.append(wrap, x, y, p, pick);
    return root;
  },
  { Props: s.object({}) },
);

const mount = () => {
  log.length = 0;
  return render(View, { props: {}, ctx: createCtx({ mode: "sim", seed: 1 }) });
};
const FOCUS = ["none", "inner", "x", "y"] as const;
const TARGET = ["wrap", "inner", "x", "y", "p"] as const;
const FOCUSABLE: ReadonlySet<string> = new Set(["inner", "x", "y"]);

/** Where a browser delivers the key fired at `target` with focus on `focus`, or `null` for E1719. */
const expected = (focus: string, target: string): string | null => {
  const inside = focus === target || (target === "wrap" && focus === "inner");
  if (inside) return focus;
  return FOCUSABLE.has(target) ? target : null;
};

describe("fire: the keydown target over focus positions", () => {
  it("the key lands on the focused element inside the target, moves focus to a focusable target, else E1719 (property)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...FOCUS), fc.constantFrom(...TARGET), async (focus, target) => {
        const t = mount();
        if (focus !== "none") await t.fire(focus, { type: "focus" });
        log.length = 0;
        const at = expected(focus, target);
        const fired = t.fire(target, { type: "keydown", key: "k" });
        if (at === null) {
          await expect(fired).rejects.toMatchObject({ code: "E1719", data: { id: target, type: "keydown" } });
          expect(log).toEqual([]);
        } else {
          await fired;
          expect(log.filter((l) => l.startsWith("keydown:")).every((l) => l.endsWith(`@${at}`))).toBe(true);
          expect(log.some((l) => l.startsWith("focus:"))).toBe(at !== focus);
          expect(t.find(at).state.focused).toBe(true);
        }
        t.dispose();
      }),
      { seed: 1337, numRuns: 60 },
    );
  });
});

describe("fire: a select pick over option sets", () => {
  it("each pick of an enabled option that changes the selection fires input then change; the rest fire none or E1726 (property)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom("o0", "o1", "o2", "o3", "none"), { minLength: 1, maxLength: 8 }),
        async (picks) => {
          const t = mount();
          let current = "o0";
          for (const value of picks) {
            log.length = 0;
            const fired = t.fire("pick", { type: "change", value });
            if (value === "o3" || value === "none") {
              await expect(fired).rejects.toMatchObject({ code: "E1726", data: { id: "pick", type: "change" } });
              expect(log).toEqual([]);
            } else {
              await fired;
              const own = log.filter((l) => l.endsWith(":pick@pick"));
              expect(own).toEqual(value === current ? [] : ["input:pick@pick", "change:pick@pick"]);
              current = value;
            }
          }
          t.dispose();
        },
      ),
      { seed: 1337, numRuns: 40 },
    );
  });
});
