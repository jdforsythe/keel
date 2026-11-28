// @vitest-environment happy-dom
// Spec: k.testing Harness (`fire` TestEvent union) and k.runtime Events (delegated and non-bubbling).
import { createCtx } from "@keel/ctx";
import { render } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Editor, notes } from "./support/components.ts";

const mountEditor = () =>
  render(Editor, {
    props: {},
    state: [[notes, { text: "", focused: false, keys: [] }]],
    ctx: createCtx({ mode: "sim", seed: 1337 }),
  });

describe("fire dispatches every TestEvent through the runtime", () => {
  it("input writes the value and reaches the delegated handler", async () => {
    const t = mountEditor();
    await t.fire("ed.input", { type: "input", value: "hello" });
    expect(t.state(notes).text).toBe("hello");
    expect(t.find("ed.out").text).toBe("hello|0");
    t.dispose();
  });

  it("focus and blur move focus and reach handlers bound on the element", async () => {
    const t = mountEditor();
    await t.fire("ed.input", { type: "focus" });
    expect(t.state(notes).focused).toBe(true);
    expect(t.find("ed.input").state.focused).toBe(true);
    await t.fire("ed.out", { type: "click" });
    expect(t.find("ed.input").state.focused).toBe(true);
    await t.fire("ed.input", { type: "blur" });
    expect(t.state(notes).focused).toBe(false);
    expect(t.find("ed.input").state.focused).toBeUndefined();
    t.dispose();
  });

  it("E1719: focus on an unfocusable element and blur off an unfocused one move nothing", async () => {
    const t = mountEditor();
    await expect(t.fire("ed.out", { type: "focus" })).rejects.toMatchObject({
      code: "E1719",
      data: { id: "ed.out", type: "focus" },
    });
    await expect(t.fire("ed.input", { type: "blur" })).rejects.toThrow(/^E1719 ed.input does not have focus/);
    await t.fire("ed.input", { type: "focus" });
    await expect(t.fire("ed.boom", { type: "blur" })).rejects.toMatchObject({ code: "E1719" });
    await expect(t.fire("ed.form", { type: "focus" })).rejects.toThrow(/^E1719 ed.form is not focusable/);
    expect(t.find("ed.input").state.focused).toBe(true);
    expect(t.state(notes).focused).toBe(true);
    t.dispose();
  });

  it("property: over any focus/blur sequence at most one element is focused and focused matches activeElement", async () => {
    const ids = ["ed.input", "ed.boom", "ed.out"] as const;
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ id: fc.constantFrom(...ids), type: fc.constantFrom(...(["focus", "blur"] as const)) }), {
          maxLength: 12,
        }),
        async (steps) => {
          const t = mountEditor();
          let active: string | undefined;
          for (const { id, type } of steps) {
            const legal = type === "focus" ? id !== "ed.out" : active === id;
            const outcome = await t.fire(id, { type }).then(
              () => "ok",
              (e: unknown) => (e instanceof Error && Reflect.get(e, "code") === "E1719" ? "E1719" : "other"),
            );
            expect(outcome).toBe(legal ? "ok" : "E1719");
            if (legal) active = type === "focus" ? id : undefined;
            const focused = ids.filter((i) => t.find(i).state.focused === true);
            expect(focused).toEqual(active === undefined ? [] : [active]);
            const current = document.activeElement?.id;
            expect(ids.find((i) => i === current)).toBe(active);
          }
          t.dispose();
        },
      ),
      { seed: 1337, numRuns: 50 },
    );
  });

  it("keydown carries the key; submit reaches the form", async () => {
    const t = mountEditor();
    await t.fire("ed.input", { type: "keydown", key: "Enter" });
    await t.fire("ed.form", { type: "submit" });
    expect(t.state(notes).keys).toEqual(["Enter"]);
    expect(t.find("ed.out").text).toBe("|1");
    t.dispose();
  });

  it("a handler throw with no Boundary rejects fire with that error", async () => {
    const t = mountEditor();
    await expect(t.fire("ed.boom", { type: "click" })).rejects.toThrow("boom");
    t.dispose();
  });

  it("after dispose, ids are gone and state() no longer lists render-owned work", async () => {
    const t = mountEditor();
    t.dispose();
    t.dispose();
    expect(() => t.find("ed.input")).toThrow(/E1705/);
    await expect(t.fire("ed.input", { type: "click" })).rejects.toThrow(/E1705/);
  });

  it("the label names the input", () => {
    const t = mountEditor();
    expect(t.find("ed.input")).toMatchObject({ role: "textbox", name: "Note" });
    expect(t.a11y("ed.form").role).toBe("form");
    t.dispose();
  });
});
