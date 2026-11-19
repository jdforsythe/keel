// @vitest-environment happy-dom
// Spec: k.errors, clause "After `resume`, an `effect` created in an island's component that throws on a later `signal.set` reports one `keel.unexpected` with `data.at` `""` (no stamped parent) and renders the root fallback in place of the island, also for an island re-rendered on the client after a mismatch; the other islands keep handling events."
// Boundaries: a throw at no element of its own (the root component's own `effect`, `computed` or render) has `data.at` the `data-k` at the root's place (the `mount` element, the island's parent), else `""`.
// Seed 1337
import { type CtxEvent, createCtx, observe } from "@keel/ctx";
import { effect, signal } from "@keel/reactive";
import { clone, on, resume, template, text } from "@keel/runtime-dom/ops";
import { describe, expect, it } from "vitest";
import { click, flush, inScope } from "./fixtures.ts";

const A_HTML = '<div data-k-island="A"><button data-k="a.btn">a</button></div>';
// Same island, but the server rendered a different tag: structural mismatch (E1253).
const A_BAD_HTML = '<section data-k-island="A"><button data-k="a.btn">a</button></section>';
const B_HTML = '<div data-k-island="B"><button id="b.count" data-k="b.count">0</button></div>';
const AT = template(A_HTML);
const BT = template(B_HTML);

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

function setup(html: string, wrap = (h: string): string => h) {
  const outer = inScope(() => signal(0));
  const sig = outer.value;
  const A = (): Node => {
    const root = clone(AT);
    effect(() => {
      if (sig.get() > 0) throw new Error(`fx${sig.get()}`);
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
  document.body.innerHTML = wrap(html) + B_HTML + KSTATE(["A", "B"]);
  const o = observed();
  const res = resume(document.body, { A, B }, { ctx: o.ctx });
  return { sig, outer, res, ...o };
}

async function expectFallbackAndLiveB(s: ReturnType<typeof setup>, at = "") {
  expect(() => s.sig.set(1)).not.toThrow();
  await flush();
  expect(errors(s.events)).toHaveLength(1);
  const err = first(s.events);
  expect(err.code).toBe("keel.unexpected");
  expect(err.message).toBe("fx1");
  expect(err.data).toMatchObject({ at });
  const pre = document.querySelector("pre[data-k-error]");
  if (pre === null) throw new Error("expected root fallback");
  expect(pre.getAttribute("data-k-error")).toBe(at);
  expect(pre.textContent).toBe("fx1");
  expect(document.querySelector('[data-k-island="A"]')).toBeNull();

  const count = document.querySelector("#b\\.count");
  if (count === null) throw new Error("fixture: missing b.count");
  click(count);
  await flush();
  expect(count.textContent).toBe("1");

  // A further set that would throw again reports nothing more.
  expect(() => s.sig.set(2)).not.toThrow();
  await flush();
  expect(errors(s.events)).toHaveLength(1);
}

describe('k.errors: after resume, an effect created in an island\'s component that throws on a later signal.set reports one keel.unexpected with data.at "" and renders the root fallback in place of the island', () => {
  it('after resume, a throwing island effect reports exactly one keel.unexpected with data.at "", renders pre[data-k-error=""] in place of the island, and other islands keep handling events', async () => {
    const s = setup(A_HTML);
    expect(JSON.stringify(s.res.warnings)).not.toContain("E1253");
    expect(errors(s.events)).toHaveLength(0);
    await expectFallbackAndLiveB(s);
    s.outer.dispose();
    document.body.innerHTML = "";
  });

  it("an island whose parent element carries data-k reports that data-k as data.at", async () => {
    const s = setup(A_HTML, (h) => `<div data-k="shell.0">${h}</div>`);
    expect(errors(s.events)).toHaveLength(0);
    expect(() => s.sig.set(1)).not.toThrow();
    await flush();
    expect(errors(s.events)).toHaveLength(1);
    expect(first(s.events).data).toMatchObject({ at: "shell.0" });
    s.outer.dispose();
    document.body.innerHTML = "";
  });

  it("also for an island re-rendered on the client after a mismatch", async () => {
    const s = setup(A_BAD_HTML);
    expect(JSON.stringify(s.res.warnings)).toContain("E1253");
    expect(errors(s.events)).toHaveLength(0);
    await expectFallbackAndLiveB(s);
    s.outer.dispose();
    document.body.innerHTML = "";
  });

  it("a further set that would throw again reports nothing more", async () => {
    const s = setup(A_HTML);
    s.sig.set(1);
    await flush();
    expect(errors(s.events)).toHaveLength(1);
    s.sig.set(2);
    s.sig.set(3);
    await flush();
    expect(errors(s.events)).toHaveLength(1);
    s.outer.dispose();
    document.body.innerHTML = "";
  });
});
