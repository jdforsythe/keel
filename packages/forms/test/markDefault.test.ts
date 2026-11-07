// @vitest-environment happy-dom
// Backlog 0166, rfc:0062: `bind` writes the bound value as the control's markup default, so server HTML shows it;
// later writes (user edits, `set`, `reset`) change the property only.
import { type Scope, scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { afterEach, describe, expect, it } from "vitest";
import { type FormState, form } from "../src/index.ts";
import { edited } from "../src/internal/edited.ts";
import { markDefault } from "../src/internal/markDefault.ts";

const Edit = s.object({
  title: s.string(),
  notes: s.string(),
  priority: s.enum(["low", "normal", "high"]),
  done: s.boolean(),
  secret: s.string(),
  size: s.int(),
});
type Value = s.infer<typeof Edit>;
const INITIAL: Value = { title: "Ada", notes: "a\nb", priority: "normal", done: true, secret: "hunter2", size: 3 };

const scopes: Scope[] = [];
afterEach(() => {
  for (const sc of scopes.splice(0)) sc.dispose();
});

function rig(initial: Value = INITIAL) {
  const box: { f?: FormState<Value> } = {};
  const title = document.createElement("input");
  const notes = document.createElement("textarea");
  const priority = document.createElement("select");
  for (const v of ["low", "normal", "high"]) {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    priority.appendChild(o);
  }
  const done = document.createElement("input");
  done.type = "checkbox";
  const secret = document.createElement("input");
  secret.type = "password";
  const size = document.createElement("input");
  size.type = "number";
  scopes.push(
    scope(() => {
      const f = form(Edit, { initial });
      box.f = f;
      f.field("title").bind(title);
      f.field("notes").bind(notes);
      f.field("priority").bind(priority);
      f.field("done").bind(done);
      f.field("secret").bind(secret);
      f.field("size").bind(size);
    }),
  );
  const f = box.f;
  if (f === undefined) throw new Error("rig: no form");
  return { f, title, notes, priority, done, secret, size };
}

const optionMarks = (sel: HTMLSelectElement): string[] =>
  Array.from(sel.options)
    .filter((o) => o.hasAttribute("selected"))
    .map((o) => o.value);

describe("bind writes the first render's value as the markup default (rfc:0062)", () => {
  it("an edit form's controls carry their values in outerHTML and as properties", () => {
    const r = rig();
    expect(r.title.outerHTML).toContain('value="Ada"');
    expect(r.title.value).toBe("Ada");
    expect(r.notes.textContent).toBe("a\nb");
    expect(r.notes.value).toBe("a\nb");
    expect(optionMarks(r.priority)).toEqual(["normal"]);
    expect(r.priority.value).toBe("normal");
    expect(r.done.hasAttribute("checked")).toBe(true);
    expect(r.done.checked).toBe(true);
    expect(r.size.getAttribute("value")).toBe("3");
  });

  it("a password input keeps no value attribute; its property is bound", () => {
    const r = rig();
    expect(r.secret.hasAttribute("value")).toBe(false);
    expect(r.secret.value).toBe("hunter2");
  });

  it("a user edit changes the property and the field, not the markup default", () => {
    const r = rig();
    r.title.value = "Adam";
    r.title.dispatchEvent(new Event("input", { bubbles: true }));
    r.done.checked = false;
    r.done.dispatchEvent(new Event("input", { bubbles: true }));
    r.priority.value = "high";
    r.priority.dispatchEvent(new Event("input", { bubbles: true }));
    expect(r.f.values()).toMatchObject({ title: "Adam", done: false, priority: "high" });
    expect(r.title.value).toBe("Adam");
    expect(r.title.getAttribute("value")).toBe("Ada");
    expect(r.done.checked).toBe(false);
    expect(r.done.hasAttribute("checked")).toBe(true);
    expect(r.priority.value).toBe("high");
    expect(optionMarks(r.priority)).toEqual(["normal"]);
  });

  it("set and reset write the property only; the default stays the first render's", () => {
    const r = rig();
    r.f.field("title").set("Grace");
    expect(r.title.value).toBe("Grace");
    expect(r.title.getAttribute("value")).toBe("Ada");
    r.f.reset();
    expect(r.title.value).toBe("Ada");
  });

  it("an absent or empty value writes no attribute", () => {
    const r = rig({ ...INITIAL, title: "", done: false });
    expect(r.title.hasAttribute("value")).toBe(false);
    expect(r.done.hasAttribute("checked")).toBe(false);
  });

  it("markDefault clears a stale default: an unchecked box drops checked, a deselected option drops selected", () => {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.setAttribute("checked", "");
    box.checked = false;
    markDefault(box);
    expect(box.hasAttribute("checked")).toBe(false);
    const sel = document.createElement("select");
    for (const v of ["a", "b"]) {
      const o = document.createElement("option");
      o.value = v;
      if (v === "a") o.setAttribute("selected", "");
      sel.appendChild(o);
    }
    sel.value = "b";
    markDefault(sel);
    expect(optionMarks(sel)).toEqual(["b"]);
    const file = document.createElement("input");
    file.type = "file";
    markDefault(file);
    expect(file.hasAttribute("value")).toBe(false);
  });
});

describe("bind keeps an edit made before it (backlog 0180)", () => {
  it("repro: an input showing value=Ada that the user changed keeps the edit; an unticked box stays unticked", () => {
    const host = document.createElement("div");
    host.innerHTML = '<input type="text" value="Ada"><input type="checkbox" checked>';
    const [title, done] = Array.from(host.querySelectorAll("input"));
    if (title === undefined || done === undefined) throw new Error("fixture");
    title.value = "typed";
    done.checked = false;
    const box: { f?: FormState<{ title: string; done: boolean }> } = {};
    scopes.push(
      scope(() => {
        const f = form(s.object({ title: s.string(), done: s.boolean() }), { initial: { title: "Ada", done: true } });
        f.field("title").bind(title);
        f.field("done").bind(done);
        box.f = f;
      }),
    );
    expect(title.value).toBe("typed");
    expect(done.checked).toBe(false);
    expect(box.f?.values()).toEqual({ title: "typed", done: false });
    expect(title.getAttribute("value")).toBe("Ada");
    expect(done.hasAttribute("checked")).toBe(true);
  });

  it("edited compares each control with its markup default", () => {
    const input = document.createElement("input");
    expect(edited(input)).toBe(false);
    input.value = "x";
    expect(edited(input)).toBe(true);
    const area = document.createElement("textarea");
    area.textContent = "a";
    expect(edited(area)).toBe(false);
    area.value = "b";
    expect(edited(area)).toBe(true);
    const sel = document.createElement("select");
    for (const v of ["a", "b"]) {
      const o = document.createElement("option");
      o.value = v;
      sel.appendChild(o);
    }
    expect(edited(sel)).toBe(false);
    sel.value = "b";
    expect(edited(sel)).toBe(true);
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = true;
    expect(edited(box)).toBe(true);
  });
});
