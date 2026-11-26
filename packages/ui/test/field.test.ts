// @vitest-environment happy-dom
// k.forms Bindings on base controls: `field` calls bind(el) and renders the error under field.errorId.
import type { Field } from "@keel/forms";
import { scope, signal } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { Checkbox, Input, Select, TextArea } from "@keel/ui";
import { describe, expect, it } from "vitest";
import { testCtx } from "./testCtx.ts";

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

/** A Field honoring the k.forms contract shape; records what it was bound to. */
const fakeField = (path: string) => {
  const bound: Element[] = [];
  const holder: { set?: (v: string | undefined) => void; field?: Field<unknown> } = {};
  const sc = scope(
    () => {
      const err = signal<string | undefined>(undefined);
      holder.set = (v) => err.set(v);
      holder.field = {
        name: path,
        id: `f:${path}`,
        errorId: `f:${path}:error`,
        value: () => undefined,
        error: () => err.get(),
        touched: () => false,
        set: () => {},
        blur: () => {},
        bind: (el) => {
          el.name = path;
          if (el.id === "") el.id = `f:${path}`;
          bound.push(el);
          return () => {};
        },
      };
    },
    { detached: true },
  );
  const { field, set } = holder;
  if (field === undefined || set === undefined) throw new Error("fakeField");
  return { field, setError: set, bound, dispose: () => sc.dispose() };
};

const controls = [
  ["Input", (f: Field<unknown>) => Input({ label: "Title", field: f }), "input"],
  ["TextArea", (f: Field<unknown>) => TextArea({ label: "Notes", field: f }), "textarea"],
  ["Select", (f: Field<unknown>) => Select({ label: "Kind", field: f }), "select"],
  ["Checkbox", (f: Field<unknown>) => Checkbox({ label: "Agree", field: f }), "input"],
] as const;

describe("base controls given a field", () => {
  for (const [name, make, tag] of controls) {
    it(`${name} binds the control, labels field.id, and renders the error under field.errorId`, async () => {
      const f = fakeField("note.title");
      const host = document.createElement("div");
      document.body.append(host);
      const dispose = mount(() => make(f.field), host, { ctx: testCtx });
      const control = host.querySelector(tag);
      expect(f.bound).toEqual([control]);
      expect(control?.id).toBe("f:note.title");
      expect(host.querySelector('label[for="f:note.title"]')).not.toBeNull();
      const msg = document.getElementById("f:note.title:error");
      expect(msg?.textContent).toBe("");
      f.setError("required");
      await flush();
      expect(msg?.textContent).toBe("required");
      f.setError(undefined);
      await flush();
      expect(msg?.textContent).toBe("");
      dispose();
      host.remove();
      f.dispose();
    });
  }
});

describe("explicit id prop with a field (ui D26)", () => {
  it("id prop wins over field.id; the label points at it", () => {
    const f = fakeField("note.title");
    const host = document.createElement("div");
    document.body.append(host);
    const dispose = mount(() => Input({ label: "Title", id: "mine", field: f.field }), host, { ctx: testCtx });
    expect(host.querySelector("input")?.id).toBe("mine");
    expect(host.querySelector('label[for="mine"]')).not.toBeNull();
    dispose();
    host.remove();
    f.dispose();
  });
});
