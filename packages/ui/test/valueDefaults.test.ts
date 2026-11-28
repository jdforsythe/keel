// @vitest-environment happy-dom
// Backlog 0166, rfc:0062: a base control's first value is its markup default (attribute and property) under a
// real form, and a resumed page keeps the user's edits: the default never overwrites the property.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import * as forms from "@keel/forms";
import { mount } from "@keel/runtime-dom";
import { resume } from "@keel/runtime-dom/ops";
import * as ui from "@keel/ui";
import { afterEach, describe, expect, it } from "vitest";
import { testCtx } from "./testCtx.ts";

const flush = async (): Promise<void> => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};

const SRC = `
import { form } from "@keel/forms";
import { s } from "@keel/schema";
import { Box, Checkbox, Input, Select, TextArea } from "@keel/ui";
const Draft = s.object({ title: s.string(), notes: s.string(), priority: s.enum(["low", "normal", "high"]), done: s.boolean() });
export default function Edit(p: { title: string }) {
  const f = form(Draft, { initial: { title: p.title, notes: "line 1\\nline 2", priority: "high", done: true } });
  return (
    <Box as="section" id="edit.root">
      <Input field={f.field("title")} label="Title" />
      <TextArea field={f.field("notes")} label="Notes" />
      <Select field={f.field("priority")} label="Priority" options={[{ value: "low", label: "Low" }, { value: "normal", label: "Normal" }, { value: "high", label: "High" }]} />
      <Checkbox field={f.field("done")} label="Done" />
    </Box>
  );
}`;

const component = (() => {
  const r = compile([{ path: "Edit.tsx", source: SRC }]);
  expect(r.diagnostics).toEqual([]);
  const fn = evaluate(r.outputs[0]?.code ?? "", { "@keel/forms": forms, "@keel/ui": ui });
  if (typeof fn !== "function") throw new Error("fixture: no default export");
  return (p: Readonly<Record<string, unknown>>): Node => {
    const n: unknown = Reflect.apply(fn, undefined, [p]);
    if (!(n instanceof Node)) throw new Error("fixture: component did not return a Node");
    return n;
  };
})();

const one = <T extends Element>(root: ParentNode, sel: string, type: new () => T): T => {
  const el = root.querySelector(sel);
  if (!(el instanceof type)) throw new Error(`fixture: no ${sel}`);
  return el;
};

const hosts: Element[] = [];
afterEach(() => {
  for (const h of hosts.splice(0)) h.remove();
});
const host = (): HTMLDivElement => {
  const h = document.createElement("div");
  document.body.appendChild(h);
  hosts.push(h);
  return h;
};

describe("ui controls bound to a form carry the first value as attribute and property (rfc:0062)", () => {
  it("Input, TextArea, Select and Checkbox: markup and property agree on first render", () => {
    const h = host();
    const dispose = mount(() => component({ title: "Ada" }), h, { ctx: testCtx });
    const input = one(h, "input[type=text]", HTMLInputElement);
    expect(input.getAttribute("value")).toBe("Ada");
    expect(input.value).toBe("Ada");
    const area = one(h, "textarea", HTMLTextAreaElement);
    expect(area.textContent).toBe("line 1\nline 2");
    expect(area.value).toBe("line 1\nline 2");
    const select = one(h, "select", HTMLSelectElement);
    expect(select.value).toBe("high");
    expect(Array.from(select.options, (o) => o.hasAttribute("selected"))).toEqual([false, false, true]);
    const box = one(h, "input[type=checkbox]", HTMLInputElement);
    expect(box.hasAttribute("checked")).toBe(true);
    expect(box.checked).toBe(true);
    dispose();
  });
});

describe("resume keeps a user's edit (rfc:0062)", () => {
  it("server HTML shows the value; after resume, an edit stays in the property and the field, the default does not return", async () => {
    // Server render: the island root's HTML, with the values in the markup.
    const scratch = host();
    const disposeScratch = mount(() => component({ title: "Ada" }), scratch, { ctx: testCtx });
    const root = scratch.firstElementChild;
    if (root === null) throw new Error("fixture: no island root");
    root.setAttribute("data-k-island", "Edit");
    const html = root.outerHTML;
    disposeScratch();
    expect(html).toContain('value="Ada"');
    expect(html).toContain(">line 1\nline 2</textarea>");
    expect(html).toMatch(/<option value="high" selected="">/);
    expect(html).toMatch(/type="checkbox"[^>]* checked=""/);

    // The browser parses the server HTML: the attribute is the control's value before the runtime loads.
    const h = host();
    const state = JSON.stringify({ stores: {}, islands: { Edit: { title: "Ada" } } });
    h.innerHTML = `${html}<script type="application/json" id="k-state">${state}</script>`;
    expect(one(h, "input[type=text]", HTMLInputElement).value).toBe("Ada");
    // (happy-dom's parser ignores `selected` on options, so the select is not checked here; the markup above is.)
    expect(one(h, "textarea", HTMLTextAreaElement).value).toBe("line 1\nline 2");
    expect(one(h, "input[type=checkbox]", HTMLInputElement).checked).toBe(true);

    resume(h, { Edit: component }, { ctx: testCtx });
    const input = one(h, "input[type=text]", HTMLInputElement);
    expect(input.value).toBe("Ada");
    input.value = "Adam";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const box = one(h, "input[type=checkbox]", HTMLInputElement);
    box.checked = false;
    box.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
    expect(input.value).toBe("Adam");
    expect(input.getAttribute("value")).toBe("Ada");
    expect(box.checked).toBe(false);
    expect(box.hasAttribute("checked")).toBe(true);
  });
});

// Backlog 0180: compiled `input`s are claimed at resume (unlike base elements, see RFC 0062 Known limits), so
// `Field.bind` runs on the server node the user already typed into.
const PLAIN = `
import { form } from "@keel/forms";
import { s } from "@keel/schema";
const D = s.object({ title: s.string(), done: s.boolean() });
export default function Plain(p: { t: string }) {
  const f = form(D, { initial: { title: p.t, done: true } });
  const root = <section id="plain.root"><input id="plain.title" type="text" /><input id="plain.done" type="checkbox" /></section>;
  const title = root.querySelector("input[type=text]");
  if (title instanceof HTMLInputElement) f.field("title").bind(title);
  const done = root.querySelector("input[type=checkbox]");
  if (done instanceof HTMLInputElement) f.field("done").bind(done);
  return root;
}`;

const plain = (() => {
  const r = compile([{ path: "Plain.tsx", source: PLAIN }]);
  expect(r.diagnostics).toEqual([]);
  const fn = evaluate(r.outputs[0]?.code ?? "", { "@keel/forms": forms });
  if (typeof fn !== "function") throw new Error("fixture: no default export");
  return (p: Readonly<Record<string, unknown>>): Node => {
    const n: unknown = Reflect.apply(fn, undefined, [p]);
    if (!(n instanceof Node)) throw new Error("fixture: component did not return a Node");
    return n;
  };
})();

describe("resume keeps an edit made before the page went live (backlog 0180)", () => {
  it("bind on a claimed server input adopts the typed value and the unticked box; the markup keeps the server default", async () => {
    const scratch = host();
    const disposeScratch = mount(() => plain({ t: "Ada" }), scratch, { ctx: testCtx });
    const root = scratch.firstElementChild;
    if (root === null) throw new Error("fixture: no island root");
    root.setAttribute("data-k-island", "Plain");
    const html = root.outerHTML;
    disposeScratch();
    expect(html).toContain('value="Ada"');

    const h = host();
    const state = JSON.stringify({ stores: {}, islands: { Plain: { t: "Ada" } } });
    h.innerHTML = `${html}<script type="application/json" id="k-state">${state}</script>`;
    const input = one(h, "input[type=text]", HTMLInputElement);
    const box = one(h, "input[type=checkbox]", HTMLInputElement);
    input.value = "typed before resume";
    box.checked = false;

    expect(resume(h, { Plain: plain }, { ctx: testCtx }).warnings).toEqual([]);
    await flush();
    expect(one(h, "input[type=text]", HTMLInputElement)).toBe(input);
    expect(input.value).toBe("typed before resume");
    expect(input.getAttribute("value")).toBe("Ada");
    expect(box.checked).toBe(false);
    expect(box.hasAttribute("checked")).toBe(true);
    // The field took the edits: a later edit flows from there, and nothing resets the property.
    input.value = "typed after";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
    expect(input.value).toBe("typed after");
  });
});
