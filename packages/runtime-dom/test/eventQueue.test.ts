// @vitest-environment happy-dom
// The pre-resume event queue: what it captures, for which island, and what replay dispatches once every island resumed.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eventQueue } from "../src/internal/eventQueue.ts";

const QUEUED = [
  "click",
  "dblclick",
  "auxclick",
  "contextmenu",
  "input",
  "beforeinput",
  "change",
  "submit",
  "reset",
  "keydown",
  "keyup",
  "pointerdown",
  "pointerup",
  "mousedown",
  "mouseup",
  "touchstart",
  "touchend",
  "focusin",
  "focusout",
];

const need = (sel: string): Element => {
  const el = document.querySelector(sel);
  if (el === null) throw new Error(`fixture: ${sel}`);
  return el;
};
const fire = (target: EventTarget, type: string): void => {
  target.dispatchEvent(new Event(type, { bubbles: true }));
};

beforeEach(() => {
  eventQueue.install();
  eventQueue.drop(0);
});
afterEach(() => {
  eventQueue.drop(0);
  document.body.innerHTML = "";
});

describe("eventQueue capture", () => {
  it("queues each interaction event type, in order, and replays them through tell", () => {
    document.body.innerHTML = '<div data-k-island="A"><button id="b">x</button></div>';
    const btn = need("#b");
    for (const t of QUEUED) fire(btn, t);
    expect(eventQueue.pending()).toBe(QUEUED.length);
    const seen: string[] = [];
    eventQueue.resume(need("[data-k-island]"), need("[data-k-island]"), (e) => seen.push(e.type));
    expect(seen).toEqual([]);
    eventQueue.replay();
    expect(seen).toEqual(QUEUED);
    expect(eventQueue.pending()).toBe(0);
  });

  it("ignores events that no island contains and types that are not interaction events", () => {
    document.body.innerHTML = '<button id="out">x</button><div data-k-island="A"><i id="in">y</i></div>';
    fire(need("#out"), "click");
    fire(need("#in"), "scroll");
    fire(need("#in"), "load");
    expect(eventQueue.pending()).toBe(0);
  });

  it("captures before the target's own handlers can stop propagation", () => {
    document.body.innerHTML = '<div data-k-island="A"><button id="b">x</button></div>';
    const btn = need("#b");
    btn.addEventListener("click", (e) => e.stopPropagation());
    fire(btn, "click");
    expect(eventQueue.pending()).toBe(1);
  });

  it("queues an event on a text node under the island, and survives events on the document", () => {
    document.body.innerHTML = '<div data-k-island="A"><p id="p">hi</p></div>';
    const text = need("#p").firstChild;
    if (text === null) throw new Error("fixture");
    fire(text, "click");
    expect(eventQueue.pending()).toBe(1);
    fire(document, "click");
    expect(eventQueue.pending()).toBe(1);
  });

  it("install twice adds no second capture", () => {
    eventQueue.install();
    document.body.innerHTML = '<div data-k-island="A"><button id="b">x</button></div>';
    fire(need("#b"), "click");
    expect(eventQueue.pending()).toBe(1);
  });

  it("tells an event to the innermost enclosing root, once replay runs after every island resumed", () => {
    document.body.innerHTML =
      '<div data-k-island="O"><div data-k-island="M"><div data-k-island="I"><button id="b">x</button></div></div></div>';
    fire(need("#b"), "click");
    const inner = need('[data-k-island="I"]');
    const mid = need('[data-k-island="M"]');
    const outer = need('[data-k-island="O"]');
    const seen: string[] = [];
    eventQueue.resume(outer, outer, (e) => seen.push(`O:${e.type}`));
    eventQueue.resume(mid, mid, (e) => seen.push(`M:${e.type}`));
    expect(seen).toEqual([]);
    expect(eventQueue.pending()).toBe(1);
    eventQueue.resume(inner, inner, (e) => seen.push(`I:${e.type}`));
    expect(seen).toEqual([]);
    expect(eventQueue.pending()).toBe(1);
    eventQueue.replay();
    expect(seen).toEqual(["I:click"]);
    expect(eventQueue.pending()).toBe(0);
  });

  it("stops queueing for an island once it has resumed", () => {
    document.body.innerHTML = '<div data-k-island="A"><button id="b">x</button></div>';
    eventQueue.resume(need("[data-k-island]"), null);
    fire(need("#b"), "click");
    expect(eventQueue.pending()).toBe(0);
  });
});

describe("eventQueue resume", () => {
  it("replays every island's events in the order they fired, after the islands resumed", () => {
    document.body.innerHTML =
      '<div id="a" data-k-island="A"><button id="ba">x</button></div><div id="c" data-k-island="C"><button id="bc">y</button></div>';
    fire(need("#ba"), "click");
    fire(need("#bc"), "keydown");
    fire(need("#ba"), "keyup");
    expect(eventQueue.pending()).toBe(3);
    const seen: string[] = [];
    eventQueue.resume(need("#a"), need("#a"), (e) => seen.push(`a:${e.type}`));
    eventQueue.resume(need("#c"), need("#c"), (e) => seen.push(`c:${e.type}`));
    expect(seen).toEqual([]);
    expect(eventQueue.pending()).toBe(3);
    eventQueue.replay();
    expect(seen).toEqual(["a:click", "c:keydown", "a:keyup"]);
    expect(eventQueue.pending()).toBe(0);
  });

  it("replays without a tell", () => {
    document.body.innerHTML = '<div data-k-island="A"><button id="b">x</button></div>';
    fire(need("#b"), "click");
    expect(() => eventQueue.resume(need("[data-k-island]"), need("[data-k-island]"))).not.toThrow();
    expect(() => eventQueue.replay()).not.toThrow();
    expect(eventQueue.pending()).toBe(0);
  });

  it("with no root (a re-rendered island) drops its events whose target left the document, firing no input", () => {
    document.body.innerHTML = '<div data-k-island="A"><input id="i" value="s"></div>';
    const island = need("[data-k-island]");
    const input = need("#i");
    if (!(input instanceof HTMLInputElement)) throw new Error("fixture");
    input.value = "typed";
    fire(input, "click");
    const seen: string[] = [];
    island.addEventListener("input", (e) => seen.push(e.type));
    island.replaceWith(document.createElement("div"));
    eventQueue.resume(island, null, (e) => seen.push(e.type));
    expect(seen).toEqual([]);
    expect(eventQueue.pending()).toBe(0);
    eventQueue.replay();
    expect(seen).toEqual([]);
  });

  it("with no root keeps an event whose target stays in the document; replay reaches the root enclosing it", () => {
    document.body.innerHTML = '<div id="o"><div data-k-island="A"><button id="b">x</button></div></div>';
    fire(need("#b"), "click");
    eventQueue.resume(need("[data-k-island]"), null);
    expect(eventQueue.pending()).toBe(1);
    const seen: string[] = [];
    eventQueue.root(need("#o"), (e) => seen.push(`o:${e.type}`));
    eventQueue.replay();
    expect(seen).toEqual(["o:click"]);
  });

  it("replay drops an event no resumed root encloses", () => {
    document.body.innerHTML = '<div data-k-island="A"><button id="b">x</button></div>';
    fire(need("#b"), "click");
    eventQueue.resume(need("[data-k-island]"), null);
    eventQueue.replay();
    expect(eventQueue.pending()).toBe(0);
  });

  it("drop(n) forgets events past the first n", () => {
    document.body.innerHTML = '<div data-k-island="A"><button id="b">x</button></div>';
    for (let i = 0; i < 4; i++) fire(need("#b"), "click");
    eventQueue.drop(9);
    expect(eventQueue.pending()).toBe(4);
    eventQueue.drop(2);
    expect(eventQueue.pending()).toBe(2);
  });
});

describe("eventQueue resume: values typed before the queue existed", () => {
  const replayed = (html: string, edit: (island: Element) => void): string[] => {
    document.body.innerHTML = `<div id="isl" data-k-island="A">${html}</div>`;
    const isl = need("#isl");
    edit(isl);
    const ids: string[] = [];
    isl.addEventListener("input", (e) => {
      ids.push(e.target instanceof Element ? e.target.id : "?");
    });
    eventQueue.resume(isl, isl);
    return ids;
  };
  const input = (isl: Element, sel: string): HTMLInputElement => {
    const el = isl.querySelector(sel);
    if (!(el instanceof HTMLInputElement)) throw new Error(`fixture: ${sel}`);
    return el;
  };

  it("dispatches an input event for each text-like control and textarea off its default, in document order", () => {
    const ids = replayed(
      '<input id="a" value="s"><textarea id="t">d</textarea><input id="n" type="number" value="1">',
      (isl) => {
        input(isl, "#a").value = "typed";
        const ta = isl.querySelector("textarea");
        if (ta === null) throw new Error("fixture");
        ta.value = "edited";
        input(isl, "#n").value = "2";
      },
    );
    expect(ids).toEqual(["a", "t", "n"]);
  });

  it("skips controls at their default and input types that hold no typed value", () => {
    const ids = replayed(
      '<input id="a" value="s"><textarea id="t">d</textarea><input id="c" type="checkbox"><input id="h" type="hidden" value="x"><input id="f" type="file">',
      (isl) => {
        input(isl, "#c").checked = true;
        input(isl, "#h").value = "y";
      },
    );
    expect(ids).toEqual([]);
  });

  it("does not synthesize an input for a control that already has one queued", () => {
    document.body.innerHTML = '<div id="isl" data-k-island="A"><input id="a" value="s"><input id="b" value="s"></div>';
    const isl = need("#isl");
    input(isl, "#a").value = "typed";
    input(isl, "#b").value = "typed";
    fire(input(isl, "#a"), "input");
    const ids: string[] = [];
    isl.addEventListener("input", (e) => {
      ids.push(e.target instanceof Element ? e.target.id : "?");
    });
    eventQueue.resume(isl, isl);
    expect(ids).toEqual(["b"]);
  });

  it("compares a single select with its default option, and ignores multiple selects", () => {
    const sel = (isl: Element, id: string): HTMLSelectElement => {
      const el = isl.querySelector(`#${id}`);
      if (!(el instanceof HTMLSelectElement)) throw new Error("fixture");
      return el;
    };
    const ids = replayed(
      '<select id="s1"><option value="a">a</option><option value="b">b</option></select>' +
        '<select id="s2"><option value="a">a</option><option value="b" selected>b</option></select>' +
        '<select id="s3"><option value="a">a</option><option value="b" selected>b</option></select>' +
        '<select id="s4" multiple><option value="a">a</option><option value="b">b</option></select>' +
        '<select id="s5"></select>',
      (isl) => {
        // happy-dom leaves `defaultSelected` null; report what a browser reports for the `selected` attribute.
        for (const id of ["s2", "s3"])
          for (const o of sel(isl, id).options)
            if (o.hasAttribute("selected")) Object.defineProperty(o, "defaultSelected", { value: true });
        sel(isl, "s1").value = "b";
        sel(isl, "s3").value = "a";
        for (const o of sel(isl, "s4").options) o.selected = o.value === "b";
      },
    );
    expect(ids).toEqual(["s1", "s3"]);
  });
});
