// @vitest-environment happy-dom
// A resumed island that fails after its claim (or after a mismatch re-render) is torn down whole: its effects,
// bindings and listeners go, and the root fallback stands in its place.
import { createCtx } from "@keel/ctx";
import { effect } from "@keel/reactive";
import { afterEach, describe, expect, it } from "vitest";
import { eventQueue } from "../src/internal/eventQueue.ts";
import { clone, on, resume, template, text } from "../src/ops/index.ts";
import { rootSignal, trackListeners } from "./support.ts";

const HTML = '<div data-k-island="T"><button id="t.boom" data-k="t.boom">x</button><span id="t.txt">0</span></div>';
const T_TPL = template(HTML);
const kState = `<script type="application/json" id="k-state">${JSON.stringify({ stores: {}, islands: { T: {} } })}</script>`;
const need = (sel: string): Element => {
  const el = document.querySelector(sel);
  if (el === null) throw new Error(`fixture: ${sel}`);
  return el;
};
const click = (el: Element): void => {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
};

afterEach(() => {
  document.body.innerHTML = "";
});

const setup = () => {
  const s = rootSignal(0);
  const calls = { effect: 0, text: 0 };
  const T = (): Node => {
    const root = clone(T_TPL);
    const span = root.querySelector("span");
    if (span === null) throw new Error("fixture");
    effect(() => {
      s.get();
      calls.effect++;
    });
    text(span, () => {
      calls.text++;
      return String(s.get());
    });
    on("t.boom", "click", () => {
      throw new Error("boom");
    });
    return root;
  };
  return { s, calls, T };
};

describe("resumed island teardown", () => {
  it("after a throw following a good claim, the effect, binding and listeners are gone", () => {
    const { s, calls, T } = setup();
    document.body.innerHTML = HTML + kState;
    const tracker = trackListeners();
    const base = tracker.live();
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const { warnings } = resume(document.body, { T }, { ctx });
    expect(warnings).toEqual([]);
    expect(tracker.live()).toBeGreaterThan(base);
    click(need("#t\\.boom"));
    expect(need('pre[data-k-error="t.boom"]').textContent).toBe("boom");
    expect(document.querySelector('[data-k-island="T"]')).toBeNull();
    const seen = { ...calls };
    s.set(1);
    expect(calls).toEqual(seen);
    expect(tracker.live()).toBe(base);
    tracker.stop();
  });

  it("after a mismatch re-render whose client later throws, the client island is torn down the same way", () => {
    const { s, calls, T } = setup();
    document.body.innerHTML = HTML.replace(/div/g, "section") + kState;
    const tracker = trackListeners();
    const base = tracker.live();
    const ctx = createCtx({ mode: "sim", seed: 1 });
    const { warnings } = resume(document.body, { T }, { ctx });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/^E1253 \[data-k-island="T"\] /);
    expect(document.querySelector("section")).toBeNull();
    expect(need("#t\\.txt").textContent).toBe("0");
    s.set(2);
    expect(need("#t\\.txt").textContent).toBe("2");
    expect(tracker.live()).toBeGreaterThan(base);
    click(need("#t\\.boom"));
    expect(need('pre[data-k-error="t.boom"]').textContent).toBe("boom");
    expect(document.querySelector('[data-k-island="T"]')).toBeNull();
    const seen = { ...calls };
    s.set(3);
    expect(calls).toEqual(seen);
    expect(tracker.live()).toBe(base);
    tracker.stop();
  });

  it("a component that returns something other than the island root is a mismatch with its own message", () => {
    document.body.innerHTML = HTML + kState;
    let renders = 0;
    const Other = (): Node => {
      renders++;
      return document.createElement("div");
    };
    const { warnings } = resume(document.body, { T: Other });
    expect(renders).toBe(2);
    expect(warnings).toEqual([
      'E1253 [data-k-island="T"] the component did not render the island root; re-rendered on the client',
    ]);
  });

  it("focus events fired while the claim runs reach no listener added after resume began, and are not queued", () => {
    document.body.innerHTML = HTML + kState;
    const seen: string[] = [];
    const before = eventQueue.pending();
    const T = (): Node => {
      const root = clone(T_TPL);
      const types = ["focus", "blur", "focusin", "focusout"];
      for (const t of types) document.addEventListener(t, (e) => seen.push(e.type), true);
      for (const t of types) document.body.dispatchEvent(new Event(t, { bubbles: true }));
      return root;
    };
    const { warnings } = resume(document.body, { T });
    expect(warnings).toEqual([]);
    expect(seen).toEqual([]);
    expect(eventQueue.pending()).toBe(before);
    document.body.dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(seen).toEqual(["focusin"]);
  });
});
