// @vitest-environment happy-dom
// Spec: k.testing Harness (`fire` TestEvent union) and k.runtime Events (delegated and non-bubbling).
import { createCtx } from "@keel/ctx";
import { render } from "@keel/testing";
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

  it("focus and blur reach handlers bound on the element", async () => {
    const t = mountEditor();
    await t.fire("ed.input", { type: "focus" });
    expect(t.state(notes).focused).toBe(true);
    await t.fire("ed.input", { type: "blur" });
    expect(t.state(notes).focused).toBe(false);
    t.dispose();
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
