// @vitest-environment happy-dom
// rfc:0064 (backlog 0174): `element` claims server elements in document order while resuming, `slot` hands a
// template's component place to the child's root, and a template's `<!--+-->` matches one server element.
import { signal } from "@keel/reactive";
import { describe, expect, it, vi } from "vitest";
import { clone, element, on, resume, slot, template, text } from "../src/ops/index.ts";

const T = template('<div id="r" data-k="r"><span id="s"></span><!--+--><p id="after">p</p></div>');

/** A base-element-like card: a `<div>` holding a `<b>` with text, built with `element`. */
const Card = (label: string): Node =>
  element("div", (el) => {
    el.setAttribute("class", "card");
    el.append(
      element("b", (b) => {
        b.textContent = label;
      }),
    );
  });

/** Island root: a template with a child component in its slot and a click counter on the span. */
const Island = (): Node => {
  const n = signal(0);
  const r = clone(T);
  const s = r.childNodes[0];
  const at = r.childNodes[1];
  if (s === undefined || at === undefined) throw new Error("fixture");
  text(s, () => n.get());
  slot(at, () => Card("hi"));
  on("s", "click", () => n.set(n.get() + 1));
  return r;
};

const SERVER =
  '<div id="r" data-k="r" data-k-island="I"><span id="s">0</span><div class="card"><b>hi</b></div><p id="after">p</p></div>';
const serve = (html: string): HTMLDivElement => {
  const h = document.createElement("div");
  h.innerHTML = `${html}<script type="application/json" id="k-state">{"stores":{},"islands":{"I":{}}}</script>`;
  return h;
};
const elements = (n: Element): Element[] => [n, ...n.querySelectorAll("*")];

describe("element and slot outside resume", () => {
  it("element creates and fills a fresh element; slot replaces its anchor", () => {
    const host = document.createElement("div");
    const a = host.appendChild(document.createComment("+"));
    slot(a, () => Card("x"));
    expect(host.innerHTML).toBe('<div class="card"><b>x</b></div>');
    const b = host.appendChild(document.createComment(""));
    slot(b, () => "text");
    expect(host.lastChild?.nodeValue).toBe("text");
  });
});

describe("resume claims element and slot nodes in place (rfc:0064)", () => {
  it("a child component in a template slot keeps every server element and binds to it", () => {
    const h = serve(SERVER);
    const before = elements(h);
    const { warnings } = resume(h, { I: Island });
    expect(warnings).toEqual([]);
    expect(elements(h)).toEqual(before);
    elements(h).forEach((e, i) => expect(e).toBe(before[i]));
    const s = h.querySelector("#s");
    s?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(s?.textContent).toBe("1");
  });

  it("an element root built with `element` is the island root", () => {
    const h = serve('<div class="card" data-k-island="I"><b>hi</b></div>');
    const root = h.firstElementChild;
    const { warnings } = resume(h, { I: () => Card("hi") });
    expect(warnings).toEqual([]);
    expect(h.firstElementChild).toBe(root);
  });

  const mismatches: [string, string, string][] = [
    ["a different tag in the slot", '<span class="card"><b>hi</b></span>', "<span> where the element is <div>"],
    ["an extra server child", '<div class="card"><b>hi</b><i></i></div>', "<div> has an extra child element"],
    ["a missing server child", '<div class="card"></div>', "missing <b> in server HTML"],
    ["no element in the slot", "", "has 2 child elements where the template has 3"],
  ];
  it.each(mismatches)("%s is E1253 and re-renders the island", (_name, card, message) => {
    const h = serve(SERVER.replace('<div class="card"><b>hi</b></div>', card));
    const { warnings } = resume(h, { I: Island });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("E1253");
    expect(warnings[0]).toContain(message);
    expect(h.querySelector(".card b")?.textContent).toBe("hi");
  });

  it("a slot whose child renders a fresh node instead of claiming is E1253", () => {
    const Fresh = (): Node => {
      const r = clone(T);
      const at = r.childNodes[1];
      if (at === undefined) throw new Error("fixture");
      slot(at, () => document.createElement("div"));
      return r;
    };
    const { warnings } = resume(serve(SERVER), { I: Fresh });
    expect(warnings.join("\n")).toContain("a child did not render the server element in its place");
  });

  it("focus inside an island survives resume, and events fired by resume itself are not replayed", () => {
    const h = serve('<div class="card" data-k-island="I"><b>hi</b><input id="f"></div>');
    document.body.appendChild(h);
    const input = h.querySelector("input");
    if (!(input instanceof HTMLInputElement)) throw new Error("fixture");
    // The user's own focus is queued and replayed once per event it fired.
    const user: string[] = [];
    const count = (): void => {
      user.push("in");
    };
    document.addEventListener("focusin", count);
    input.focus();
    document.removeEventListener("focusin", count);
    const seen: string[] = [];
    const Moving = (): Node =>
      element("div", (el) => {
        const f = document.createDocumentFragment();
        f.append(
          element("b", () => undefined),
          element("input", (i) => {
            on(i, "focusin", () => seen.push("in"));
            on(i, "focusout", () => seen.push("out"));
          }),
        );
        el.append(f);
      });
    // Backlog 0185: giving the focus back never scrolls a user who scrolled during load.
    const spy = vi.spyOn(HTMLElement.prototype, "focus");
    const { warnings } = resume(h, { I: Moving });
    expect(spy).toHaveBeenCalledWith({ preventScroll: true });
    spy.mockRestore();
    expect(warnings).toEqual([]);
    expect(document.activeElement).toBe(input);
    expect(seen).toEqual(user);
    h.remove();
  });

  it("a throw while claiming (a template node the server HTML lacks) is E1253 with a client re-render, never a raw throw (backlog 0184)", () => {
    const W = template('<div id="w"><b>x</b><!----></div>');
    const Walk = (): Node => {
      const r = clone(W);
      const anchor = r.childNodes[1];
      if (anchor === undefined) throw new TypeError("no anchor at childNodes[1]");
      anchor.replaceWith(document.createTextNode("tail"));
      return r;
    };
    const h = serve('<div id="w" data-k-island="I"><b>x</b></div>');
    const server = h.firstElementChild;
    const { warnings } = resume(h, { I: Walk });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("E1253");
    expect(warnings[0]).toContain("no anchor at childNodes[1]");
    expect(h.firstElementChild).not.toBe(server);
    expect(h.firstElementChild?.textContent).toBe("xtail");
  });
});
