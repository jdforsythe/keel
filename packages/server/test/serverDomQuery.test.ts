// @vitest-environment node
// Server DOM selectors and form controls (backlog 0156): the subset compiled templates and `@keel/runtime-dom` use
// (`[id="…"]`, `[data-k="…"]`, `#id`, type, `.class`, `[name]`, compounds and "," lists, CSS escapes) and a
// SyntaxError naming anything else; input, select, textarea and option state as in a browser.
import { describe, expect, it } from "vitest";
import { ServerDocument } from "../src/internal/dom/ServerDocument.ts";
import type { ServerElement } from "../src/internal/dom/ServerElement.ts";
import { ServerInput } from "../src/internal/dom/ServerInput.ts";
import { ServerSelect } from "../src/internal/dom/ServerSelect.ts";
import { ServerTextArea } from "../src/internal/dom/ServerTextArea.ts";
import { parseHtml } from "../src/internal/dom/parseHtml.ts";

const doc = new ServerDocument();
const tree = (html: string): ServerElement => {
  const root = doc.createElement("div");
  parseHtml(doc, html, root);
  return root;
};
const HTML =
  '<section id="s" class="a  b"><p id="a.1" data-k="a.1" title="t">x</p><span id="q&quot;u" class="b">y</span>' +
  '<template><b id="hidden"></b></template><script id="k-state" type="application/json">{}</script></section>';

describe("server DOM selectors", () => {
  const root = tree(HTML);
  const id = (sel: string): string | null => root.querySelector(sel)?.getAttribute("id") ?? null;

  it.each([
    ['[id="a.1"]', "a.1"],
    ["[id='a.1']", "a.1"],
    ['[data-k="a.1"]', "a.1"],
    ['[id="q\\"u"]', 'q"u'],
    ["[id=q\\22 u]", 'q"u'],
    ["#s", "s"],
    ["#a\\.1", "a.1"],
    ["p", "a.1"],
    ["P", "a.1"],
    ["*", "s"],
    [".b", "s"],
    ["span.b", 'q"u'],
    ["[title]", "a.1"],
    ['  [ TITLE = "t" ]  ', "a.1"],
    ["script#k-state", "k-state"],
    ["i, span", 'q"u'],
    ["span, p", "a.1"],
    ['[id="hidden"]', null],
    ['[id="a"]', null],
    [".a.c", null],
  ])("querySelector(%j) finds %j", (sel, want) => {
    expect(id(sel)).toBe(want);
  });

  it("matches, closest and querySelectorAll; the root itself is never a querySelector result", () => {
    const p = root.querySelector("p");
    expect(p?.matches("[data-k]")).toBe(true);
    expect(p?.matches("span")).toBe(false);
    expect(p?.closest("section")?.id).toBe("s");
    expect(p?.closest("p")).toBe(p);
    expect(p?.closest("ul")).toBeNull();
    expect(root.querySelectorAll("[id]").map((e) => e.id)).toEqual(["s", "a.1", 'q"u', "k-state"]);
    expect(root.querySelector("div")).toBeNull();
    expect(doc.querySelector("p")).toBeNull();
    expect(doc.createDocumentFragment().querySelectorAll("p")).toEqual([]);
  });

  it.each([
    "",
    "div p",
    "div > p",
    "a + b",
    "a ~ b",
    "p:first-child",
    "::before",
    '[id^="a"]',
    "[id|=a]",
    "#1",
    ".1",
    ",p",
    "p,",
    "p,,a",
    "p*",
    '[id="a]',
    "#a.1",
  ])("%j throws a SyntaxError naming the selector", (sel) => {
    expect(() => root.querySelector(sel)).toThrow(
      expect.objectContaining({
        name: "SyntaxError",
        message: expect.stringContaining("k.server: unsupported selector"),
      }),
    );
    expect(() => doc.querySelector(sel)).toThrow(/unsupported selector/);
  });
});

describe("server DOM form controls", () => {
  it("createElement and parseHtml give inputs, selects and textareas their classes; clones keep their state", () => {
    expect(doc.createElement("INPUT")).toBeInstanceOf(ServerInput);
    const root = tree('<input name="n" value="v"><select><option>a</option></select><textarea>t</textarea>');
    expect(root.childNodes.map((c) => c.constructor.name)).toEqual(["ServerInput", "ServerSelect", "ServerTextArea"]);
    const input = root.querySelector("input");
    if (!(input instanceof ServerInput)) throw new Error("no input");
    input.value = "typed";
    const copy = input.cloneNode(true);
    expect(copy).toBeInstanceOf(ServerInput);
    expect(Reflect.get(copy, "value")).toBe("typed");
    expect(copy.outerHTML).toBe('<input name="n" value="v">');
  });

  it("input: type defaults to text, value and checked are state, not markup, except for attribute-valued types", () => {
    const el = doc.createElement("input");
    if (!(el instanceof ServerInput)) throw new Error("no input");
    expect(el.type).toBe("text");
    el.setAttribute("type", "Bogus");
    expect(el.type).toBe("text");
    el.setAttribute("value", "a");
    expect(el.value).toBe("a");
    el.value = "b";
    expect([el.value, el.getAttribute("value")]).toEqual(["b", "a"]);
    el.name = "title";
    expect(el.outerHTML).toBe('<input type="Bogus" value="a" name="title">');
    el.type = "checkbox";
    expect(el.value).toBe("a");
    el.removeAttribute("value");
    expect(el.value).toBe("on");
    el.value = "yes";
    expect(el.getAttribute("value")).toBe("yes");
    expect(el.checked).toBe(false);
    el.setAttribute("checked", "");
    expect(el.checked).toBe(true);
    el.checked = false;
    expect([el.checked, el.hasAttribute("checked")]).toEqual([false, true]);
    el.disabled = true;
    expect(el.getAttribute("disabled")).toBe("");
    el.disabled = false;
    expect(el.hasAttribute("disabled")).toBe(false);
    el.type = "file";
    expect(el.value).toBe("");
    el.value = "";
    expect(() => {
      el.value = "x";
    }).toThrow(expect.objectContaining({ name: "InvalidStateError" }));
  });

  it("select: value is the selected option's (last marked, else first enabled), set selects the first match", () => {
    const root = tree(
      '<select><option disabled>z</option><option value="a">A</option><optgroup><option selected> b  c </option></optgroup><option value="d" selected>D</option></select>',
    );
    const sel = root.firstElementChild;
    if (!(sel instanceof ServerSelect)) throw new Error("no select");
    expect(sel.type).toBe("select-one");
    expect(sel.value).toBe("d");
    sel.value = "b c";
    expect(sel.value).toBe("b c");
    expect(sel.options.map((o) => o.selected)).toEqual([false, false, true, false]);
    sel.value = "none";
    expect(sel.value).toBe("a");
    expect(sel.outerHTML).toContain('<option value="d" selected="">D</option>');
    sel.setAttribute("multiple", "");
    expect([sel.type, sel.value]).toEqual(["select-multiple", ""]);
  });

  it("textarea: value is the text content until written", () => {
    const ta = doc.createElement("textarea");
    if (!(ta instanceof ServerTextArea)) throw new Error("no textarea");
    ta.textContent = "x";
    expect([ta.type, ta.value]).toEqual(["textarea", "x"]);
    ta.value = "y";
    expect([ta.value, ta.outerHTML]).toEqual(["y", "<textarea>x</textarea>"]);
    expect(Reflect.get(ta.cloneNode(true), "value")).toBe("y");
  });
});
