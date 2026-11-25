// @vitest-environment happy-dom
// k.defaults, Submit "A `submit` on a form inside an island that has not resumed is queued with its default prevented at capture. At replay its handlers run as for any queued event; if none called `preventDefault()`, the runtime then submits the form once, natively, with no second `submit` event, as the browser would have: the submitter's `name` and `value` in the data, and its `formaction`, `formmethod`, `formenctype` and `formtarget` used. A queued submit whose island has no component, so no root encloses it, is submitted the same way once the queue replays. One whose form left the document (its island re-rendered, E1253) is dropped. During replay such an event's `defaultPrevented` reads `true` whatever the handlers did."
// k.defaults, Links "A `click` inside an `a[href]` is not queued unless the link is to a fragment of the same document (`href` starting `#`): the browser follows it at once, and no island handler sees that click. A fragment link's click is queued and replayed; its scroll has already happened."
// k.defaults, Others "Every other queued event keeps the default action it had when it fired, and a handler's `preventDefault()` at replay changes nothing: a checkbox or radio is toggled and its `input` and `change` replay; typed text stays and its `input` replays (a value typed before the queue existed is synced by k.runtime's `input`); `keydown` Enter in a field submits through `submit` above; `reset` resets. A `submit` outside every island, or in one that has resumed, is not touched by the queue."
// Spec: k.defaults, clause "A `submit` dispatched (`cancelable`) on a form in an unresumed island is `defaultPrevented` once dispatched; after `resume` its island handler, which calls `preventDefault()`, runs once, and the form is not submitted natively (stubbed `submit` and `requestSubmit` are not called) and no second `submit` event fires."
// Spec: k.defaults, clause "The same with a handler that does not call `preventDefault()`: after `resume` the form is submitted natively once, its data holding the submitter's `name` and `value` and its `formaction` used, and a counting `submit` listener on `document` sees one event in all."
// Spec: k.defaults, clause "A queued submit on a form in an island with no compiled component is submitted natively once after `resume`; one on a form in an island that mismatches and re-renders is not submitted."
// Spec: k.defaults, clause "A `click` before `resume` on `<a href=\"/other\">` in an island is not `defaultPrevented`, and its island handler does not run after `resume`; on `<a href=\"#part\">` the handler runs once after `resume`."
// Spec: k.defaults, clause "A click before `resume` on a checkbox in an island leaves it checked; its `change` handler runs once after `resume`, and a click handler calling `preventDefault()` then leaves it checked."
// Spec: k.defaults, clause "A `submit` on a form outside every island, or in a resumed island, is not `defaultPrevented` by the queue."
// Seed: 1337 (the properties below). Hand-built compiled islands as fixtures.ts does. `submit` and `requestSubmit` of
// HTMLFormElement are replaced for each test by recorders of their calls and the form data at the call.
import { createCtx } from "@keel/ctx";
import { on, resume, template } from "@keel/runtime-dom/ops";
import type { Island } from "@keel/runtime-dom/ops";
import { clone } from "@keel/runtime-dom/ops";
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SEED, flush } from "./fixtures.ts";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

type Call = { readonly kind: "submit" | "requestSubmit"; readonly action: string; readonly data: [string, string][] };

const FORM = `<form id="f" data-k="f"><input name="q" value="x"><button id="b" name="op" value="save" formaction="/other">go</button></form>`;
const KSTATE = (names: readonly string[]): string =>
  `<script type="application/json" id="k-state">${JSON.stringify({ stores: {}, islands: Object.fromEntries(names.map((n) => [n, {}])) })}</script>`;

let calls: Call[] = [];
const original = { submit: HTMLFormElement.prototype.submit, requestSubmit: HTMLFormElement.prototype.requestSubmit };
let submitEvents = 0;
const count = (): void => {
  submitEvents += 1;
};

/** A hit counter a handler bumps. */
function counter() {
  const c = {
    n: 0,
    hit: (): void => {
      c.n += 1;
    },
  };
  return c;
}

function record(kind: Call["kind"], form: HTMLFormElement): void {
  const data: [string, string][] = [];
  for (const [k, v] of new FormData(form)) data.push([k, String(v)]);
  calls.push({ kind, action: form.getAttribute("action") ?? "", data });
}

beforeEach(() => {
  calls = [];
  submitEvents = 0;
  HTMLFormElement.prototype.submit = function (this: HTMLFormElement) {
    record("submit", this);
  };
  HTMLFormElement.prototype.requestSubmit = function (this: HTMLFormElement) {
    record("requestSubmit", this);
  };
  document.addEventListener("submit", count, true);
});
afterEach(() => {
  HTMLFormElement.prototype.submit = original.submit;
  HTMLFormElement.prototype.requestSubmit = original.requestSubmit;
  document.removeEventListener("submit", count, true);
  document.body.innerHTML = "";
});

/** An island `name` whose markup is `html`; `wire` binds its handlers. */
function island(name: string, html: string, wire: () => void): { markup: string; component: Island } {
  const markup = `<div data-k-island="${name}">${html}</div>`;
  const t = template(markup);
  const component = (): Node => {
    const root = clone(t);
    wire();
    return root;
  };
  return { markup, component };
}

function el(selector: string): Element {
  const found = document.querySelector(selector);
  if (found === null) throw new Error(`fixture: no ${selector}`);
  return found;
}

function formOf(selector: string): HTMLFormElement {
  const found = el(selector);
  if (!(found instanceof HTMLFormElement)) throw new Error(`fixture: ${selector} is not a form`);
  return found;
}

function submitOn(form: Element): SubmitEvent {
  const submitter = form.querySelector("button");
  const ev = new SubmitEvent("submit", {
    bubbles: true,
    cancelable: true,
    ...(submitter === null ? {} : { submitter }),
  });
  form.dispatchEvent(ev);
  return ev;
}

const natives = (): Call[] => calls;

describe("k.defaults Submit: a queued submit goes out once, as the browser would have sent it", () => {
  it("a cancelable submit before resume is defaultPrevented; after resume the handler that prevents it runs once, nothing is submitted natively and no second submit event fires", async () => {
    const hits = counter();
    const S = island("S", FORM, () =>
      on("f", "submit", (e: Event) => {
        hits.hit();
        e.preventDefault();
      }),
    );
    document.body.innerHTML = `${S.markup}${KSTATE(["S"])}`;
    const ev = submitOn(el("#f"));
    expect(ev.defaultPrevented).toBe(true);
    resume(document.body, { S: S.component }, { ctx: simCtx });
    await flush();
    expect(hits.n).toBe(1);
    expect(natives()).toEqual([]);
    expect(submitEvents).toBe(1);
  });

  it("a handler that does not prevent it: after resume one native submission with the submitter's name and value and its formaction, and one submit event in all", async () => {
    const hits = counter();
    const S = island("S", FORM, () => on("f", "submit", hits.hit));
    document.body.innerHTML = `${S.markup}${KSTATE(["S"])}`;
    const ev = submitOn(el("#f"));
    expect(ev.defaultPrevented).toBe(true);
    resume(document.body, { S: S.component }, { ctx: simCtx });
    await flush();
    expect(hits.n).toBe(1);
    expect(natives()).toHaveLength(1);
    expect(natives()[0]?.kind).toBe("submit");
    expect(natives()[0]?.data).toContainEqual(["op", "save"]);
    expect(natives()[0]?.action).toBe("/other");
    expect(submitEvents).toBe(1);
    await flush();
    expect(natives()).toHaveLength(1);
  });

  it("during replay the event's defaultPrevented reads true whatever the handlers did", async () => {
    const seen: boolean[] = [];
    const S = island("S", FORM, () => on("f", "submit", (e: Event) => void seen.push(e.defaultPrevented)));
    document.body.innerHTML = `${S.markup}${KSTATE(["S"])}`;
    submitOn(el("#f"));
    resume(document.body, { S: S.component }, { ctx: simCtx });
    await flush();
    expect(seen).toEqual([true]);
  });

  it("the form's own action and the submitter's pair do not stay changed after the native submission", async () => {
    const S = island("S", FORM, () => on("f", "submit", () => undefined));
    document.body.innerHTML = `${S.markup}${KSTATE(["S"])}`;
    submitOn(el("#f"));
    resume(document.body, { S: S.component }, { ctx: simCtx });
    await flush();
    expect(el("#f").getAttribute("action")).toBeNull();
    expect(new FormData(formOf("#f")).get("op")).toBeNull();
  });

  it("a queued submit on a form in an island with no compiled component is submitted natively once after resume", async () => {
    document.body.innerHTML = `<div data-k-island="Bare">${FORM}</div>${KSTATE(["Bare"])}`;
    const ev = submitOn(el("#f"));
    expect(ev.defaultPrevented).toBe(true);
    resume(document.body, {}, { ctx: simCtx });
    await flush();
    expect(natives()).toHaveLength(1);
    expect(natives()[0]?.data).toContainEqual(["op", "save"]);
    expect(submitEvents).toBe(1);
  });

  it("a queued submit on a form in an island that mismatches and re-renders is not submitted", async () => {
    const M = island("M", `<p id="p">other</p>`, () => undefined);
    document.body.innerHTML = `<div data-k-island="M">${FORM}</div>${KSTATE(["M"])}`;
    submitOn(el("#f"));
    const { warnings } = resume(document.body, { M: M.component }, { ctx: simCtx });
    await flush();
    expect(JSON.stringify(warnings)).toContain("E1253");
    expect(natives()).toEqual([]);
  });

  it("property: for any submitter name and value, the data of the one native submission holds that pair once", async () => {
    const word = fc.stringMatching(/^[a-z]{1,8}$/);
    await fc.assert(
      fc.asyncProperty(word, word, async (name, value) => {
        calls = [];
        document.body.innerHTML = "";
        const html = `<form id="f" data-k="f"><button id="b" name="${name}" value="${value}">go</button></form>`;
        const S = island("S", html, () => on("f", "submit", () => undefined));
        document.body.innerHTML = `${S.markup}${KSTATE(["S"])}`;
        submitOn(el("#f"));
        resume(document.body, { S: S.component }, { ctx: simCtx });
        await flush();
        expect(natives()).toHaveLength(1);
        expect(natives()[0]?.data.filter(([k, v]) => k === name && v === value)).toHaveLength(1);
      }),
      { seed: SEED, numRuns: 15 },
    );
  });

  it("negative: a submit on a form outside every island, and one in an already resumed island, is not defaultPrevented by the queue", async () => {
    const S = island("S", FORM, () => on("f", "submit", () => undefined));
    document.body.innerHTML = `<form id="out"><button>go</button></form>${S.markup}${KSTATE(["S"])}`;
    expect(submitOn(el("#out")).defaultPrevented).toBe(false);
    resume(document.body, { S: S.component }, { ctx: simCtx });
    await flush();
    expect(submitOn(el("#f")).defaultPrevented).toBe(false);
    expect(natives()).toEqual([]);
  });
});

describe("k.defaults Links: a link click is not queued unless it is to a fragment of the same document", () => {
  it('a click before resume on `<a href="/other">` is not defaultPrevented and its island handler does not run after resume', async () => {
    const hits = counter();
    const L = island("L", `<a id="l" data-k="l" href="/other">go</a>`, () => on("l", "click", hits.hit));
    document.body.innerHTML = `${L.markup}${KSTATE(["L"])}`;
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    el("#l").dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    resume(document.body, { L: L.component }, { ctx: simCtx });
    await flush();
    expect(hits.n).toBe(0);
  });

  it('a click before resume on `<a href="#part">` has its island handler run once after resume', async () => {
    const hits = counter();
    const L = island("L", `<a id="l" data-k="l" href="#part">go</a>`, () => on("l", "click", hits.hit));
    document.body.innerHTML = `${L.markup}${KSTATE(["L"])}`;
    el("#l").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    resume(document.body, { L: L.component }, { ctx: simCtx });
    await flush();
    expect(hits.n).toBe(1);
  });

  it("a click on an element inside an `a[href]` is not queued either", async () => {
    const hits = counter();
    const L = island("L", `<a id="l" href="/other"><span id="in" data-k="in">go</span></a>`, () =>
      on("in", "click", hits.hit),
    );
    document.body.innerHTML = `${L.markup}${KSTATE(["L"])}`;
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    el("#in").dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    resume(document.body, { L: L.component }, { ctx: simCtx });
    await flush();
    expect(hits.n).toBe(0);
  });
});

describe("k.defaults Others: every other queued event keeps the default it had when it fired", () => {
  it("a click before resume on a checkbox leaves it checked; its change handler runs once after resume", async () => {
    const changes = counter();
    const C = island("C", `<input id="c" data-k="c" type="checkbox">`, () => on("c", "change", changes.hit));
    document.body.innerHTML = `${C.markup}${KSTATE(["C"])}`;
    const box = el("#c");
    box.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(box instanceof HTMLInputElement && box.checked).toBe(true);
    resume(document.body, { C: C.component }, { ctx: simCtx });
    await flush();
    expect(changes.n).toBe(1);
    expect(box instanceof HTMLInputElement && box.checked).toBe(true);
  });

  it("a click handler calling preventDefault at replay leaves the checkbox checked", async () => {
    const C = island("C", `<input id="c" data-k="c" type="checkbox">`, () =>
      on("c", "click", (e: Event) => e.preventDefault()),
    );
    document.body.innerHTML = `${C.markup}${KSTATE(["C"])}`;
    const box = el("#c");
    box.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    resume(document.body, { C: C.component }, { ctx: simCtx });
    await flush();
    expect(box instanceof HTMLInputElement && box.checked).toBe(true);
  });

  it("a click before resume on a radio leaves it checked", async () => {
    const R = island("R", `<input id="r" data-k="r" type="radio" name="g">`, () => undefined);
    document.body.innerHTML = `${R.markup}${KSTATE(["R"])}`;
    const radio = el("#r");
    radio.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    resume(document.body, { R: R.component }, { ctx: simCtx });
    await flush();
    expect(radio instanceof HTMLInputElement && radio.checked).toBe(true);
  });

  it("property: input, change, reset and keydown fired before resume are not defaultPrevented, and each handler runs once after resume", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("input", "change", "reset", "keydown"), async (type) => {
        document.body.innerHTML = "";
        const hits = counter();
        const T = island("T", `<form id="tf"><input id="t" data-k="t" type="text"></form>`, () =>
          on("t", type, hits.hit),
        );
        document.body.innerHTML = `${T.markup}${KSTATE(["T"])}`;
        const ev =
          type === "keydown"
            ? new KeyboardEvent(type, { key: "Enter", bubbles: true, cancelable: true })
            : new Event(type, { bubbles: true, cancelable: true });
        el("#t").dispatchEvent(ev);
        expect(ev.defaultPrevented).toBe(false);
        resume(document.body, { T: T.component }, { ctx: simCtx });
        await flush();
        expect(hits.n).toBe(1);
        expect(natives()).toEqual([]);
      }),
      { seed: SEED, numRuns: 8 },
    );
  });
});
