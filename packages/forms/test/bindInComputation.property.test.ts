// @vitest-environment happy-dom
// k.forms Bindings: a control edited before bind keeps its value and the field takes it, also when `bind` runs inside
// another computation's build (a structural op rendering its branch at resume runs it inside its effect, whose
// declared writes do not name the form's signals). Seed 1337.
import { form } from "@keel/forms";
import { effect, owner, scope } from "@keel/reactive";
import { s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";

const S = s.object({ title: s.string() });

/** A served text input whose markup default is `served`, edited to `typed`. */
function edited(served: string, typed: string): HTMLInputElement {
  const div = document.createElement("div");
  div.innerHTML = `<input type="text" value="${served}">`;
  const input = div.querySelector("input");
  if (!(input instanceof HTMLInputElement)) throw new Error("parse");
  input.value = typed;
  return input;
}

/** Binds `el` to a fresh form's `title` from inside an effect that declares no writes, as a branch build does. */
function bindInEffect(el: HTMLInputElement, initial: string) {
  const box: { values?: () => unknown } = {};
  const root = scope(() => {
    const f = form(S, { initial: { title: initial } });
    box.values = f.values;
    const home = owner();
    effect(() => {
      home?.run(() => scope(() => void f.field("title").bind(el)));
    });
  });
  return { values: () => box.values?.(), root };
}

test("bind inside an effect's build takes an edited control's value without an undeclared write", () => {
  const el = edited("Ada", "typed");
  const { values, root } = bindInEffect(el, "Ada");
  expect(values()).toEqual({ title: "typed" });
  expect(el.value).toBe("typed");
  expect(el.getAttribute("value")).toBe("Ada");
  root.dispose();
});

test("bind inside an effect's build leaves an unedited control at the field's value", () => {
  const el = edited("Ada", "Ada");
  const { values, root } = bindInEffect(el, "Ada");
  expect(values()).toEqual({ title: "Ada" });
  expect(el.value).toBe("Ada");
  root.dispose();
});

test("property: whatever was typed before bind, inside an effect's build the field and the control hold it", () => {
  const text = fc.string({ maxLength: 12 }).filter((t) => !/["<>&]/.test(t));
  fc.assert(
    fc.property(text, text, (served, typed) => {
      const el = edited(served, typed);
      const { values, root } = bindInEffect(el, served);
      expect(values()).toEqual({ title: typed });
      expect(el.value).toBe(typed);
      root.dispose();
    }),
    { seed: 1337 },
  );
});
