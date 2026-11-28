// @vitest-environment happy-dom
// Spec: k.ui, clause "An `Input`, `TextArea`, `Select` or `Checkbox` given a signal for `value` or `checked` shows its first value in the markup; a later signal write changes only the property."
import { createCtx } from "@keel/ctx";
import { type Signal, scope, signal } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { Checkbox, Input, Select, TextArea } from "@keel/ui";
import { expect, test } from "vitest";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
const owned = <T>(init: T): Signal<T> => {
  const slot: Signal<T>[] = [];
  scope(
    () => {
      slot.push(signal(init));
    },
    { detached: true },
  );
  const [sig] = slot;
  if (sig === undefined) throw new Error("no signal");
  return sig;
};
const host = (): HTMLElement => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
};
const find = (root: ParentNode, id: string): Element => {
  const el = root.querySelector(`#${id}`);
  if (el === null) throw new Error(`no element ${id}`);
  return el;
};

test("An Input given a signal for value shows its first value in the markup; a later signal write changes only the property", async () => {
  const v = owned("Ada");
  const root = host();
  const off = mount(() => Input({ id: "i", label: "I", value: v }), root, { ctx: simCtx });
  await flush();
  const el = find(root, "i");
  if (!(el instanceof HTMLInputElement)) throw new Error("not input");
  expect(el.outerHTML).toContain('value="Ada"');
  expect(el.value).toBe("Ada");
  v.set("Grace");
  await flush();
  expect(el.value).toBe("Grace");
  expect(el.getAttribute("value")).toBe("Ada");
  off();
});

test("A TextArea given a signal for value shows its first value as text; a later signal write changes only the property", async () => {
  const v = owned("notes");
  const root = host();
  const off = mount(() => TextArea({ id: "t", label: "T", value: v }), root, { ctx: simCtx });
  await flush();
  const el = find(root, "t");
  if (!(el instanceof HTMLTextAreaElement)) throw new Error("not textarea");
  expect(el.outerHTML).toContain(">notes<");
  expect(el.value).toBe("notes");
  v.set("other");
  await flush();
  expect(el.value).toBe("other");
  expect(el.textContent).toBe("notes");
  expect(el.outerHTML).toContain(">notes<");
  off();
});

test("A Select given a signal for value marks the matching option selected; a later signal write changes only the property", async () => {
  const v = owned("b");
  const root = host();
  const off = mount(
    () =>
      Select({
        id: "s",
        label: "S",
        value: v,
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
          { value: "c", label: "C" },
        ],
      }),
    root,
    { ctx: simCtx },
  );
  await flush();
  const el = find(root, "s");
  if (!(el instanceof HTMLSelectElement)) throw new Error("not select");
  const marked = (): string[] =>
    [...el.querySelectorAll("option")].filter((o) => o.hasAttribute("selected")).map((o) => o.value);
  expect(marked()).toEqual(["b"]);
  expect(el.value).toBe("b");
  v.set("c");
  await flush();
  expect(el.value).toBe("c");
  expect(marked()).toEqual(["b"]);
  off();
});

test("A Checkbox given a signal for checked shows checked in the markup; a later signal write changes only the property", async () => {
  const c = owned(true);
  const root = host();
  const off = mount(() => Checkbox({ id: "c", label: "C", checked: c }), root, { ctx: simCtx });
  await flush();
  const el = find(root, "c");
  if (!(el instanceof HTMLInputElement)) throw new Error("not input");
  expect(el.outerHTML).toContain("checked");
  expect(el.checked).toBe(true);
  c.set(false);
  await flush();
  expect(el.checked).toBe(false);
  expect(el.hasAttribute("checked")).toBe(true);
  off();
});
