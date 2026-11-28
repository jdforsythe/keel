// @vitest-environment happy-dom
// Spec: k.forms, clause "Binding a control whose value differs from its markup default (edited before bind) keeps that value, sets the field to it, and leaves the markup."
// Seed 1337 (no generated inputs; examples only: the clause is about one fixed parse-edit-bind order).
import { form } from "@keel/forms";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { expect, test } from "vitest";

const S = s.object({
  title: s.string(),
  notes: s.string(),
  priority: s.string(),
  done: s.boolean(),
});

const HTML =
  '<input type="text" value="Ada"><textarea>notes</textarea><select><option value="low">Low</option><option value="high" selected>High</option></select><input type="checkbox" checked>';

function parse() {
  const div = document.createElement("div");
  div.innerHTML = HTML;
  const input = div.querySelector('input[type="text"]');
  const area = div.querySelector("textarea");
  const select = div.querySelector("select");
  const box = div.querySelector('input[type="checkbox"]');
  if (
    !(input instanceof HTMLInputElement) ||
    !(area instanceof HTMLTextAreaElement) ||
    !(select instanceof HTMLSelectElement) ||
    !(box instanceof HTMLInputElement)
  )
    throw new Error("parse");
  return { div, input, area, select, box };
}

function bindAll(els: ReturnType<typeof parse>) {
  const handle: { f?: ReturnType<typeof form<typeof S>> } = {};
  const root = scope(
    () => {
      const f = form(S, { initial: { title: "Ada", notes: "notes", priority: "high", done: true } });
      handle.f = f;
      f.field("title").bind(els.input);
      f.field("notes").bind(els.area);
      f.field("priority").bind(els.select);
      f.field("done").bind(els.box);
    },
    { detached: true },
  );
  if (handle.f === undefined) throw new Error("no form");
  return { f: handle.f, root };
}

test("Binding a control whose value differs from its markup default keeps that value and sets the field to it", () => {
  const els = parse();
  els.input.value = "typed";
  els.area.value = "typed notes";
  els.select.value = "low";
  els.box.checked = false;
  const { f, root } = bindAll(els);
  expect(els.input.value).toBe("typed");
  expect(els.area.value).toBe("typed notes");
  expect(els.select.value).toBe("low");
  expect(els.box.checked).toBe(false);
  expect(f.values()).toEqual({ title: "typed", notes: "typed notes", priority: "low", done: false });
  root.dispose();
});

test("Binding a control whose value differs from its markup default leaves the markup", () => {
  const els = parse();
  els.input.value = "typed";
  els.area.value = "typed notes";
  els.select.value = "low";
  els.box.checked = false;
  const { root } = bindAll(els);
  expect(els.input.getAttribute("value")).toBe("Ada");
  expect(els.area.textContent).toBe("notes");
  const selected = [...els.select.querySelectorAll("option")].filter((o) => o.hasAttribute("selected"));
  expect(selected.map((o) => o.value)).toEqual(["high"]);
  expect(els.box.hasAttribute("checked")).toBe(true);
  root.dispose();
});

test("A control not edited before bind still shows the initial value (control case)", () => {
  const els = parse();
  const { f, root } = bindAll(els);
  expect(els.input.value).toBe("Ada");
  expect(els.area.value).toBe("notes");
  expect(els.select.value).toBe("high");
  expect(els.box.checked).toBe(true);
  expect(f.values()).toEqual({ title: "Ada", notes: "notes", priority: "high", done: true });
  root.dispose();
});
