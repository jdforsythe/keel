// @vitest-environment happy-dom
// Spec: k.forms, clause "A bound `input`, `textarea`, `select` and checkbox show the bound value in their markup from the first render (`value` attribute, text, `selected`, `checked`); a later user edit changes the property, not the markup."
// Seed 1337 (fc.assert seed below). Radio pair: not covered (spec names no radio behavior).
import { form } from "@keel/forms";
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";

const S = s.object({
  name: s.string(),
  notes: s.string(),
  color: s.string(),
  done: s.boolean(),
  secret: s.string(),
});

function make<E extends HTMLElement>(tag: string, ctor: new () => E): E {
  const el = document.createElement(tag);
  if (!(el instanceof ctor)) throw new Error(`not ${tag}`);
  return el;
}

function setup() {
  const input = make("input", HTMLInputElement);
  const area = make("textarea", HTMLTextAreaElement);
  const select = make("select", HTMLSelectElement);
  for (const v of ["red", "green", "blue"]) {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    select.appendChild(o);
  }
  const box = make("input", HTMLInputElement);
  box.type = "checkbox";
  const pw = make("input", HTMLInputElement);
  pw.type = "password";
  const handle: { f?: ReturnType<typeof form<typeof S>> } = {};
  const root = scope(() => {
    const f = form(S, { initial: { name: "Ada", notes: "notes", color: "green", done: true, secret: "hunter2" } });
    handle.f = f;
    f.field("name").bind(input);
    f.field("notes").bind(area);
    f.field("color").bind(select);
    f.field("done").bind(box);
    f.field("secret").bind(pw);
  });
  if (handle.f === undefined) throw new Error("no form");
  return { f: handle.f, input, area, select, box, pw, root };
}

test("A bound input, textarea, select and checkbox show the bound value in their markup from the first render", () => {
  const { input, area, select, box, root } = setup();
  expect(input.outerHTML).toContain('value="Ada"');
  expect(input.value).toBe("Ada");
  expect(area.outerHTML).toContain(">notes<");
  expect(area.value).toBe("notes");
  const selected = [...select.querySelectorAll("option")].filter((o) => o.hasAttribute("selected"));
  expect(selected.map((o) => o.value)).toEqual(["green"]);
  expect(select.value).toBe("green");
  expect(box.outerHTML).toContain("checked");
  expect(box.checked).toBe(true);
  root.dispose();
});

test("A later user edit changes the property, not the markup (input, textarea, select, checkbox)", () => {
  const { f, input, area, select, box, root } = setup();
  input.value = "Grace";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  area.value = "other";
  area.dispatchEvent(new Event("input", { bubbles: true }));
  select.value = "blue";
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
  box.checked = false;
  box.dispatchEvent(new Event("input", { bubbles: true }));
  box.dispatchEvent(new Event("change", { bubbles: true }));

  expect(f.field("name").value()).toBe("Grace");
  expect(f.field("notes").value()).toBe("other");
  expect(f.field("color").value()).toBe("blue");
  expect(f.field("done").value()).toBe(false);

  expect(input.value).toBe("Grace");
  expect(input.outerHTML).toContain('value="Ada"');
  expect(area.value).toBe("other");
  expect(area.outerHTML).toContain(">notes<");
  expect(select.value).toBe("blue");
  expect(select.querySelector("option[selected]")?.getAttribute("value")).toBe("green");
  expect(box.checked).toBe(false);
  expect(box.outerHTML).toContain("checked");
  root.dispose();
});

test("A password input bound with an initial value gets no value attribute", () => {
  const { pw, root } = setup();
  expect(pw.hasAttribute("value")).toBe(false);
  expect(pw.outerHTML).not.toContain("hunter2");
  root.dispose();
});

// Generated strings exclude "\r" and "\0" (HTML parsing normalizes them); the textarea
// additionally excludes a leading "\n" (the parser drops one).
const safe = fc.string().filter((v) => !v.includes("\r") && !v.includes("\0"));

function roundTrip(tag: "input" | "textarea", value: string): string {
  const el = document.createElement(tag);
  const T = s.object({ v: s.string() });
  const root = scope(() => {
    form(T, { initial: { v: value } })
      .field("v")
      .bind(
        el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
          ? el
          : (() => {
              throw new Error("bad element");
            })(),
      );
  });
  const host = document.createElement("div");
  host.innerHTML = el.outerHTML;
  root.dispose();
  const parsed = host.firstElementChild;
  if (!(parsed instanceof HTMLInputElement || parsed instanceof HTMLTextAreaElement)) throw new Error("not parsed");
  return parsed.value;
}

test("Serialized markup of a bound text input parses back to an element whose value equals the initial string", () => {
  fc.assert(
    fc.property(safe, (v) => {
      expect(roundTrip("input", v)).toBe(v);
    }),
    { seed: 1337, numRuns: 100 },
  );
});

test("Serialized markup of a bound textarea parses back to an element whose value equals the initial string", () => {
  fc.assert(
    fc.property(
      safe.filter((v) => !v.startsWith("\n")),
      (v) => {
        expect(roundTrip("textarea", v)).toBe(v);
      },
    ),
    { seed: 1337, numRuns: 100 },
  );
});
