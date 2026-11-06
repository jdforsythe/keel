// @vitest-environment happy-dom
// Spec: k.ui Conformance 7 (RFC 0009). Real DOM events on the element found by id; handlers register via the delegated `on`.
import { mount } from "@keel/runtime-dom";
import { Box, Button, Checkbox, Input, Select, TextArea } from "@keel/ui";
import { describe, expect, it } from "vitest";

const host = (): HTMLElement => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
};
const byId = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`no element ${id}`);
  return el;
};

describe("k.ui: fire click on a Button with onClick calls the handler once; change on a Checkbox with onChange passes the new checked state", () => {
  it("a click on a Button with onClick calls the handler once", () => {
    const calls: number[] = [];
    const root = host();
    const off = mount(() => Button({ id: "go", label: "Go", onClick: () => calls.push(1) }), root);
    byId("go").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(calls).toEqual([1]);
    off();
  });
  it("a change on a Checkbox with onChange passes the new checked state", () => {
    const seen: boolean[] = [];
    const root = host();
    const off = mount(() => Checkbox({ id: "done", label: "Done", onChange: (c) => seen.push(c) }), root);
    const box = byId("done");
    if (!(box instanceof HTMLInputElement)) throw new Error("not an input");
    box.checked = true;
    box.dispatchEvent(new Event("change", { bubbles: true }));
    box.checked = false;
    box.dispatchEvent(new Event("change", { bubbles: true }));
    expect(seen).toEqual([true, false]);
    off();
  });
  it("an input on Input and TextArea passes the value; a change on Select passes the value", () => {
    const seen: string[] = [];
    const root = host();
    const off = mount(
      () =>
        Box({
          children: [
            Input({ id: "i", label: "I", onInput: (v) => seen.push(`i:${v}`) }),
            TextArea({ id: "t", label: "T", onInput: (v) => seen.push(`t:${v}`) }),
            Select({
              id: "s",
              label: "S",
              options: [
                { value: "a", label: "A" },
                { value: "b", label: "B" },
              ],
              onChange: (v) => seen.push(`s:${v}`),
            }),
          ],
        }),
      root,
    );
    for (const [id, v, type] of [
      ["i", "x", "input"],
      ["t", "y", "input"],
      ["s", "b", "change"],
    ] as const) {
      const el = byId(id);
      Reflect.set(el, "value", v);
      el.dispatchEvent(new Event(type, { bubbles: true }));
    }
    expect(seen).toEqual(["i:x", "t:y", "s:b"]);
    off();
  });
  it("disposing the mount removes the handlers", () => {
    const calls: number[] = [];
    const root = host();
    const off = mount(() => Button({ id: "gone", label: "Go", onClick: () => calls.push(1) }), root);
    const el = byId("gone");
    off();
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(calls).toEqual([]);
  });
});
