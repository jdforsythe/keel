// @vitest-environment happy-dom
// Spec: k.testing Conformance, "`fire(id, { type: 'focus' })` on an input makes `find(id).state.focused` true; `blur` makes it false."
// Spec: k.testing Harness `fire` ("`focus`, `blur`; both move focus") and Rules "E1719 `fire` `focus` on an unfocusable element, or `blur` off an unfocused one". Seed: 1337.
// Assumed: the delegated `on(id, "focus" | "blur", handler)` of `@keel/runtime-dom/ops` receives the events the DOM dispatches.
import { clone, on, template } from "@keel/runtime-dom/ops";
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, codeOf, flatten, simCtx, thrown } from "./fixtures.ts";

const log: string[] = [];
const T = template(
  [
    '<div id="root" data-k="root">',
    '<input id="a" data-k="a" aria-label="A">',
    '<input id="b" data-k="b" aria-label="B">',
    '<button id="btn" data-k="btn">Go</button>',
    '<button id="off" data-k="off" disabled>Off</button>',
    '<input id="hid" data-k="hid" type="hidden">',
    '<div id="plain" data-k="plain">plain</div>',
    '<div id="tab" data-k="tab" tabindex="0">tab</div>',
    "</div>",
  ].join(""),
);
const View = Object.assign(
  (): Node => {
    const root = clone(T);
    for (const id of ["a", "b", "btn", "off", "hid", "plain", "tab"]) {
      on(id, "focus", () => log.push(`focus:${id}`));
      on(id, "blur", () => log.push(`blur:${id}`));
    }
    return root;
  },
  { Props: s.object({}) },
);

const mount = () => {
  log.length = 0;
  return render(View, { props: {}, ctx: simCtx() });
};
const focusedIds = (t: ReturnType<typeof mount>): string[] =>
  ["a", "b", "btn", "off", "hid", "plain", "tab"].filter((id) => t.find(id).state.focused === true);

describe("k.testing: fire focus and blur move focus (RFC 0091 A)", () => {
  it("fire(id, { type: 'focus' }) on an input makes find(id).state.focused true; blur makes it false", async () => {
    const t = mount();
    expect(t.find("a").state.focused).not.toBe(true);
    await t.fire("a", { type: "focus" });
    expect(t.find("a").state.focused).toBe(true);
    await t.fire("a", { type: "blur" });
    expect(t.find("a").state.focused).not.toBe(true);
    t.dispose();
  });

  it("fire focus moves focus to the element and its focus event reaches handlers once", async () => {
    await fc.assert(
      // Seed 1337: a sequence of focus targets; each fire focuses exactly its target and calls its handler once.
      fc.asyncProperty(
        fc.array(fc.constantFrom("a", "b", "btn", "tab"), { minLength: 1, maxLength: 6 }),
        async (ids) => {
          const t = mount();
          let prev: string | undefined;
          for (const id of ids) {
            if (id === prev) continue;
            const before = log.filter((l) => l === `focus:${id}`).length;
            await t.fire(id, { type: "focus" });
            expect(log.filter((l) => l === `focus:${id}`).length).toBe(before + 1);
            expect(focusedIds(t)).toEqual([id]);
            prev = id;
          }
          t.dispose();
        },
      ),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("fire focus on a second element blurs the first: blur reaches the one losing focus once and only one element is focused", async () => {
    const t = mount();
    await t.fire("a", { type: "focus" });
    await t.fire("b", { type: "focus" });
    expect(log.filter((l) => l === "blur:a")).toHaveLength(1);
    expect(log.filter((l) => l === "focus:b")).toHaveLength(1);
    expect(log.indexOf("blur:a")).toBeLessThan(log.indexOf("focus:b"));
    expect(focusedIds(t)).toEqual(["b"]);
    t.dispose();
  });

  it("fire blur removes focus and its blur event reaches handlers once", async () => {
    const t = mount();
    await t.fire("a", { type: "focus" });
    await t.fire("a", { type: "blur" });
    expect(log.filter((l) => l === "blur:a")).toHaveLength(1);
    expect(focusedIds(t)).toEqual([]);
    t.dispose();
  });

  it("the focused flag of find(id).state and of a11y() reports focus", async () => {
    const t = mount();
    await t.fire("btn", { type: "focus" });
    expect(t.find("btn").state.focused).toBe(true);
    const node = flatten(t.a11y()).find((n) => n.id === "btn");
    expect(node?.state).toMatchObject({ focused: true });
    await t.fire("btn", { type: "blur" });
    const after = flatten(t.a11y()).find((n) => n.id === "btn");
    expect(after?.state).not.toMatchObject({ focused: true });
    t.dispose();
  });

  it("fire click does not move focus", async () => {
    const t = mount();
    await t.fire("a", { type: "focus" });
    await t.fire("btn", { type: "click" });
    expect(focusedIds(t)).toEqual(["a"]);
    t.dispose();
  });

  it("E1719 fire focus on an element a user cannot focus (a plain div, a disabled button, a hidden input) rejects with E1719 and moves nothing", async () => {
    for (const id of ["plain", "off", "hid"]) {
      const t = mount();
      await t.fire("a", { type: "focus" });
      const e = await thrown(() => t.fire(id, { type: "focus" }));
      expect(codeOf(e)).toBe("E1719");
      expect(focusedIds(t)).toEqual(["a"]);
      expect(log.filter((l) => l === `focus:${id}`)).toEqual([]);
      t.dispose();
    }
  });

  it("E1719 fire focus on an element with a tabindex does not reject", async () => {
    const t = mount();
    expect(await thrown(() => t.fire("tab", { type: "focus" }))).toBeUndefined();
    expect(t.find("tab").state.focused).toBe(true);
    t.dispose();
  });

  it("E1719 fire blur on an element that does not have focus rejects with E1719", async () => {
    const t = mount();
    expect(codeOf(await thrown(() => t.fire("a", { type: "blur" })))).toBe("E1719");
    await t.fire("a", { type: "focus" });
    expect(codeOf(await thrown(() => t.fire("b", { type: "blur" })))).toBe("E1719");
    expect(focusedIds(t)).toEqual(["a"]);
    await t.fire("a", { type: "blur" });
    expect(codeOf(await thrown(() => t.fire("a", { type: "blur" })))).toBe("E1719");
    t.dispose();
  });
});
