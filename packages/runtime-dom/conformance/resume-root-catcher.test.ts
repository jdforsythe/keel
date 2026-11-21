// @vitest-environment happy-dom
// Spec: k.errors, clause "After `resume`, an island whose handler throws reports one `keel.unexpected` with that element's id as `data.at` to an observer and renders the root fallback, holding only `keel.unexpected`, in place of the island; the page's other islands keep handling events; under `mount` the same throw reports the same error."
// Seed 1337
import { type CtxEvent, createCtx, observe } from "@keel/ctx";
import { signal } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { clone, on, resume, template, text } from "@keel/runtime-dom/ops";
import { describe, expect, it } from "vitest";
import { click, flush, inScope } from "./fixtures.ts";

const A_HTML = '<div data-k-island="A"><button id="a.boom" data-k="a.boom">boom</button></div>';
const B_HTML = '<div data-k-island="B"><button id="b.count" data-k="b.count">0</button></div>';
// Handler element carries only `data-k` (no `id`).
const D_HTML = '<div data-k-island="D"><button data-k="d.only">go</button></div>';
const BT = template(B_HTML);
const DT = template(D_HTML);
const AT0 = template(A_HTML);

const A = (): Node => {
  const root = clone(AT0);
  on("a.boom", "click", () => {
    throw new Error("boom");
  });
  return root;
};
const B = (): Node => {
  const root = clone(BT);
  const n = signal(0);
  const button = root.querySelector("#b\\.count");
  if (button === null) throw new Error("fixture: template lacks b.count");
  text(button, () => String(n.get()));
  on("b.count", "click", () => n.set(n.get() + 1));
  return root;
};
const D = (): Node => {
  const root = clone(DT);
  on("d.only", "click", () => {
    throw new Error("boom");
  });
  return root;
};

const KSTATE = (islands: string[]): string =>
  `<script type="application/json" id="k-state">${JSON.stringify({
    stores: {},
    islands: Object.fromEntries(islands.map((i) => [i, {}])),
  })}</script>`;

const errors = (events: CtxEvent[]) => events.filter((e) => e.kind === "error");

function observed() {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const events: CtxEvent[] = [];
  observe(ctx, (e) => {
    events.push(e);
  });
  return { ctx, events };
}

function first(events: CtxEvent[]) {
  const e = errors(events)[0];
  if (e === undefined || e.kind !== "error") throw new Error("expected an error event");
  return e.error;
}

describe("k.errors: after resume, an island whose handler throws reports one keel.unexpected with that element's id as data.at and renders the root fallback in place of the island", () => {
  it("after resume, a throwing handler reports exactly one keel.unexpected with data.at the element id, renders pre[data-k-error] in place of the island, and other islands keep handling events", async () => {
    document.body.innerHTML = A_HTML + B_HTML + KSTATE(["A", "B"]);
    const { ctx, events } = observed();
    resume(document.body, { A, B }, { ctx });
    const boom = document.querySelector("#a\\.boom");
    if (boom === null) throw new Error("fixture: missing a.boom");
    expect(() => click(boom)).not.toThrow();
    await flush();
    const errs = errors(events);
    expect(errs).toHaveLength(1);
    const err = first(events);
    expect(err.code).toBe("keel.unexpected");
    expect(err.message).toBe("boom");
    expect(err.data).toMatchObject({ at: "a.boom" });
    const pre = document.querySelector('pre[data-k-error="a.boom"]');
    expect(pre?.textContent).toBe("keel.unexpected");
    expect(document.querySelector('[data-k-island="A"]')).toBeNull();
    expect(document.querySelector("#a\\.boom")).toBeNull();

    const count = document.querySelector("#b\\.count");
    if (count === null) throw new Error("fixture: missing b.count");
    click(count);
    await flush();
    expect(count.textContent).toBe("1");
    click(count);
    await flush();
    expect(count.textContent).toBe("2");
    expect(errors(events)).toHaveLength(1);
    document.body.innerHTML = "";
  });

  it("under mount the same throw reports the same error", async () => {
    document.body.innerHTML = A_HTML + B_HTML + KSTATE(["A", "B"]);
    const viaResume = observed();
    resume(document.body, { A, B }, { ctx: viaResume.ctx });
    const boomR = document.querySelector("#a\\.boom");
    if (boomR === null) throw new Error("fixture: missing a.boom");
    click(boomR);
    await flush();
    document.body.innerHTML = "";

    const el = document.createElement("div");
    document.body.appendChild(el);
    const viaMount = observed();
    const h = inScope(() => mount(A, el, { ctx: viaMount.ctx }));
    const boomM = el.querySelector("#a\\.boom");
    if (boomM === null) throw new Error("fixture: missing a.boom under mount");
    expect(() => click(boomM)).not.toThrow();
    await flush();
    expect(errors(viaMount.events)).toHaveLength(1);
    const m = first(viaMount.events);
    const r = first(viaResume.events);
    expect(m.code).toBe(r.code);
    expect(m.code).toBe("keel.unexpected");
    expect(m.message).toBe(r.message);
    expect(m.message).toBe("boom");
    expect(m.data).toMatchObject({ at: "a.boom" });
    expect(r.data).toMatchObject({ at: "a.boom" });
    h.value();
    h.dispose();
    el.remove();
  });

  it("a handler on an element whose id is set only via data-k reports that data-k value as data.at", async () => {
    document.body.innerHTML = D_HTML + KSTATE(["D"]);
    const { ctx, events } = observed();
    resume(document.body, { D }, { ctx });
    const btn = document.querySelector('[data-k="d.only"]');
    if (btn === null) throw new Error("fixture: missing d.only");
    expect(btn.hasAttribute("id")).toBe(false);
    click(btn);
    await flush();
    expect(errors(events)).toHaveLength(1);
    expect(first(events).data).toMatchObject({ at: "d.only" });
    expect(document.querySelector('pre[data-k-error="d.only"]')?.textContent).toBe("keel.unexpected");
    document.body.innerHTML = "";
  });
});
