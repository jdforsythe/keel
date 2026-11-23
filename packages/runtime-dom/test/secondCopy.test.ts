// @vitest-environment happy-dom
// A second copy of the runtime in the realm (a harness's fresh module graph) keeps the same rules: the URL rule and
// its attribute table, the event types bound on the element, and the input events reported to a ctx's observers,
// masked for a secret field.
import type { CtxEvent } from "@keel/ctx";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  document.body.replaceChildren();
});

async function copy() {
  vi.resetModules();
  const [{ mount }, ops, url, { createCtx, observe }] = await Promise.all([
    import("../src/index.ts"),
    import("../src/ops/index.ts"),
    import("../src/url/index.ts"),
    import("@keel/ctx"),
  ]);
  return { mount, ops, url, createCtx, observe };
}

describe("the URL rule in a second copy", () => {
  it("allows http, https, mailto and tel in any case, and no other scheme", async () => {
    const { isSafeUrl } = (await copy()).url;
    for (const scheme of ["http", "https", "mailto", "tel", "HTTP", "Https", "MAILTO", "Tel"])
      expect(isSafeUrl("href", `${scheme}:x`)).toBe(true);
    for (const v of ["javascript:x", "JavaScript:x", "data:text/html,x", "ftp:x", "a+b.c-d:x", "x:", "x1:", "h:"])
      expect(isSafeUrl("href", v)).toBe(false);
  });

  it("reads a scheme only at the start of the value", async () => {
    const { isSafeUrl } = (await copy()).url;
    for (const v of [
      "",
      "a",
      "1abc:x",
      "-a:x",
      "foo/javascript:x",
      "?javascript:x",
      "#javascript:x",
      "//host/p",
      "/a:b",
    ])
      expect(isSafeUrl("href", v)).toBe(true);
    expect(isSafeUrl("href", " \tjava\nscript:x")).toBe(false);
  });

  it("polices every URL attribute, in any case, and no other attribute", async () => {
    const { isSafeUrl, URL_ATTRS } = (await copy()).url;
    const names = [
      "href",
      "src",
      "action",
      "formaction",
      "xlink:href",
      "poster",
      "ping",
      "data",
      "srcset",
      "imagesrcset",
      "to",
      "from",
      "by",
      "values",
    ];
    for (const name of names) {
      expect(isSafeUrl(name, "javascript:x")).toBe(false);
      expect(isSafeUrl(name.toUpperCase(), "javascript:x")).toBe(false);
      expect(isSafeUrl(name, "https://keel.example/x")).toBe(true);
      expect(URL_ATTRS.has(name)).toBe(true);
    }
    expect(URL_ATTRS.size).toBe(names.length);
    for (const name of ["", "title", "class", "alt", "value", "id"]) expect(isSafeUrl(name, "javascript:x")).toBe(true);
  });

  it("checks each item of a list attribute", async () => {
    const { isSafeUrl } = (await copy()).url;
    for (const name of ["ping", "srcset", "imagesrcset"]) {
      expect(isSafeUrl(name, "/a.png 1x, https://keel.example/b.png 2x")).toBe(true);
      for (const sep of ["\t", "\n", "\f", "\r", " ", ","]) {
        expect(isSafeUrl(name, `/a.png${sep}javascript:x`)).toBe(false);
        expect(isSafeUrl(name, `/a.png${sep}/b.png`)).toBe(true);
      }
    }
    expect(isSafeUrl("values", "/a;/b;https://keel.example/c")).toBe(true);
    expect(isSafeUrl("values", "/a;javascript:x")).toBe(false);
    expect(isSafeUrl("href", "/a.png javascript:x")).toBe(true);
    expect(isSafeUrl("to", "/a;javascript:x")).toBe(true);
  });

  it("never allows a raw-HTML attribute", async () => {
    const { isSafeUrl, RAW_HTML_ATTRS } = (await copy()).url;
    expect(isSafeUrl("srcdoc", "")).toBe(false);
    expect(isSafeUrl("SrcDoc", "plain")).toBe(false);
    expect([...RAW_HTML_ATTRS]).toEqual(["srcdoc"]);
  });
});

describe("events in a second copy", () => {
  it.each(["focus", "blur", "mouseenter", "mouseleave", "scroll", "load", "error", "cancel", "close"])(
    "%s is bound on the element: an event that does not bubble reaches its handler until dispose",
    async (type) => {
      const { mount, ops, createCtx } = await copy();
      const T = ops.template('<div id="outer"><input id="a"></div>');
      const host = document.createElement("div");
      document.body.append(host);
      let heard = 0;
      const dispose = mount(
        () => {
          const f = ops.clone(T);
          ops.on("a", type, () => heard++);
          return f;
        },
        host,
        { ctx: createCtx({ mode: "sim", seed: 1 }) },
      );
      const a = host.querySelector("#a");
      a?.dispatchEvent(new Event(type));
      expect(heard).toBe(1);
      host.querySelector("#outer")?.dispatchEvent(new Event(type));
      expect(heard).toBe(1);
      dispose();
      a?.dispatchEvent(new Event(type));
      expect(heard).toBe(1);
    },
  );

  const page = async () => {
    const { mount, ops, createCtx, observe } = await copy();
    const T = ops.template(
      '<form id="f"><input id="plain"><input id="pw" type="password"><input id="cur" autocomplete="username current-password"><input id="new" autocomplete="new-password"><input id="pii" data-k-pii><input><button id="go" type="button">go</button></form>',
    );
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const got: CtxEvent[] = [];
    observe(ctx, (e) => {
      if (e.kind === "fire") got.push(e);
    });
    const host = document.createElement("div");
    document.body.append(host);
    const dispose = mount(() => ops.clone(T), host, { ctx });
    const el = (selector: string): Element => {
      const e = host.querySelector(selector);
      if (e === null) throw new Error(`no ${selector}`);
      return e;
    };
    return { got, el, dispose };
  };

  it("reports click, change, submit, focus and blur on an element with an id, before any handler", async () => {
    const { got, el, dispose } = await page();
    for (const type of ["click", "change", "submit", "focus", "blur"])
      el("#go").dispatchEvent(new Event(type, { bubbles: type !== "focus" && type !== "blur" }));
    el("#go").dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(got).toEqual(
      ["click", "change", "submit", "focus", "blur"].map((type) => ({ kind: "fire", id: "go", event: { type } })),
    );
    dispose();
  });

  it("reports nothing for an element with no id on it or above it", async () => {
    const { mount, ops, createCtx, observe } = await copy();
    const T = ops.template("<p><button>go</button></p>");
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const got: CtxEvent[] = [];
    observe(ctx, (e) => void got.push(e));
    const host = document.createElement("div");
    document.body.append(host);
    const dispose = mount(() => ops.clone(T), host, { ctx });
    host.querySelector("button")?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(got).toEqual([]);
    dispose();
  });

  it("reports input and keydown with the value and key, under the nearest id for an element without one", async () => {
    const { got, el, dispose } = await page();
    Reflect.set(el("#plain"), "value", "milk");
    el("#plain").dispatchEvent(new Event("input", { bubbles: true }));
    el("#plain").dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "m" }));
    el("#plain").dispatchEvent(new Event("keydown", { bubbles: true }));
    el("input:not([id])").dispatchEvent(new Event("input", { bubbles: true }));
    el("input:not([id])").dispatchEvent(new Event("click", { bubbles: true }));
    expect(got).toEqual([
      { kind: "fire", id: "plain", event: { type: "input", value: "milk" } },
      { kind: "fire", id: "plain", event: { type: "keydown", key: "m" } },
      { kind: "fire", id: "plain", event: { type: "keydown", key: "" } },
      { kind: "fire", id: "f", event: { type: "input", value: "" } },
      { kind: "fire", id: "f", event: { type: "click" } },
    ]);
    dispose();
  });

  it.each(["pw", "cur", "new", "pii"])("masks the value and one-character keys of the secret field #%s", async (id) => {
    const { got, el, dispose } = await page();
    Reflect.set(el(`#${id}`), "value", "s3cret");
    el(`#${id}`).dispatchEvent(new Event("input", { bubbles: true }));
    el(`#${id}`).dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "s" }));
    el(`#${id}`).dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    expect(got).toEqual([
      { kind: "fire", id, event: { type: "input", value: "xxxxxx" } },
      { kind: "fire", id, event: { type: "keydown", key: "x" } },
      { kind: "fire", id, event: { type: "keydown", key: "Enter" } },
    ]);
    dispose();
  });
});

describe("the pre-resume queue in a second copy", () => {
  it("queues each interaction event on an island not yet resumed, and no other type", async () => {
    vi.resetModules();
    const { eventQueue } = await import("../src/internal/eventQueue.ts");
    eventQueue.install();
    eventQueue.drop(0);
    const island = document.createElement("div");
    island.setAttribute("data-k-island", "second.copy");
    const button = document.createElement("button");
    island.append(button);
    document.body.append(island);
    const queued = [
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
    for (const [i, type] of queued.entries()) {
      button.dispatchEvent(new Event(type, { bubbles: true }));
      expect([type, eventQueue.pending()]).toEqual([type, i + 1]);
    }
    for (const type of ["", "pointermove", "scroll", "focus", "keypress", "Stryker was here"])
      button.dispatchEvent(new Event(type, { bubbles: true }));
    expect(eventQueue.pending()).toBe(queued.length);
    eventQueue.drop(0);
    expect(eventQueue.pending()).toBe(0);
  });
});
