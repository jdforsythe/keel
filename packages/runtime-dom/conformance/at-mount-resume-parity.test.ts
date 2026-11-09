// @vitest-environment happy-dom
// Spec: k.errors, clause "The same component and the same click report the same `data.at` under `mount` and after `resume`, for a handler's throw and for a binding's throw (the element the binding writes) when the handler's write makes the computed it reads throw."
// Seed 1337
import { type CtxEvent, createCtx, observe } from "@keel/ctx";
import { computed, signal } from "@keel/reactive";
import { mount } from "@keel/runtime-dom";
import { clone, on, resume, template, text } from "@keel/runtime-dom/ops";
import { describe, expect, it } from "vitest";
import { click, flush, inScope } from "./fixtures.ts";

const P_HTML =
  '<div data-k-island="P"><button id="p.go" data-k="p.go">go</button><pre id="p.out" data-k="p.out"> </pre></div>';
const PT = template(P_HTML);
const KSTATE = `<script type="application/json" id="k-state">${JSON.stringify({ stores: {}, islands: { P: {} } })}</script>`;

// Binding variant: the click toggles `open`, making the computed the pre's text reads throw.
const Binding = (): Node => {
  const root = clone(PT);
  const open = signal(false);
  const c = computed(() => (open.get() ? "x".repeat(-1) : ""));
  const out = root.querySelector("#p\\.out");
  if (out === null) throw new Error("fixture: template lacks p.out");
  const node = out.firstChild;
  if (node === null) throw new Error("fixture: p.out lacks a text node");
  text(node, () => c.get());
  on("p.go", "click", () => open.set(!open.get()));
  return root;
};

// Handler variant: the click handler throws directly.
const Handler = (): Node => {
  const root = clone(PT);
  on("p.go", "click", () => {
    throw new Error("boom");
  });
  return root;
};

function observed() {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const events: CtxEvent[] = [];
  observe(ctx, (e) => {
    events.push(e);
  });
  return { ctx, events };
}

function singleAt(events: CtxEvent[]): unknown {
  const errs = events.filter((e) => e.kind === "error");
  expect(errs).toHaveLength(1);
  const e = errs[0];
  if (e === undefined || e.kind !== "error") throw new Error("expected an error event");
  return Reflect.get(Object(e.error.data), "at");
}

async function atUnderMount(C: () => Node): Promise<unknown> {
  document.body.innerHTML = "";
  const host = document.createElement("div");
  document.body.appendChild(host);
  const { ctx, events } = observed();
  const h = inScope(() => mount(C, host, { ctx }));
  const go = host.querySelector("#p\\.go");
  if (go === null) throw new Error("fixture: missing p.go under mount");
  click(go);
  await flush();
  const at = singleAt(events);
  h.value();
  h.dispose();
  host.remove();
  return at;
}

async function atAfterResume(C: () => Node): Promise<unknown> {
  document.body.innerHTML = P_HTML + KSTATE;
  const { ctx, events } = observed();
  resume(document.body, { P: C }, { ctx });
  const go = document.querySelector("#p\\.go");
  if (go === null) throw new Error("fixture: missing p.go after resume");
  click(go);
  await flush();
  const at = singleAt(events);
  document.body.innerHTML = "";
  return at;
}

describe("k.errors: the same component and the same click report the same data.at under mount and after resume", () => {
  it("for a handler's throw, data.at is the same under mount and after resume (the handler's element)", async () => {
    const m = await atUnderMount(Handler);
    const r = await atAfterResume(Handler);
    expect(m).toBe(r);
    expect(m).toBe("p.go");
  });

  it("for a binding's throw when the handler's write makes the computed it reads throw, data.at is the same under mount and after resume (the element the binding writes)", async () => {
    const m = await atUnderMount(Binding);
    const r = await atAfterResume(Binding);
    expect(m).toBe(r);
    expect(m).toBe("p.out");
    expect(r).toBe("p.out");
  });
});
