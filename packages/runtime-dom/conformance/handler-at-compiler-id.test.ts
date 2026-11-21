// @vitest-environment happy-dom
// Spec: k.errors, clause "A handler registered with `on(element, …)` on an element whose `id` is set at runtime throws with `data.at` the `data-k` of its nearest ancestor that has one, else `""`; `attr(el, "data-k", …)` sets nothing."
// Seed 1337
import { type CtxEvent, createCtx, observe } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { attr, clone, on, template } from "@keel/runtime-dom/ops";
import { describe, expect, it } from "vitest";
import { click, flush, inScope } from "./fixtures.ts";

const RUNTIME_ID = "user@example.com";
const LT = template('<ul data-k="list.0"></ul>');

function observed() {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const events: CtxEvent[] = [];
  observe(ctx, (e) => {
    events.push(e);
  });
  return { ctx, events };
}

const errors = (events: CtxEvent[]) => events.filter((e) => e.kind === "error");

function first(events: CtxEvent[]) {
  const e = errors(events)[0];
  if (e === undefined || e.kind !== "error") throw new Error("expected an error event");
  return e.error;
}

const boom = (): void => {
  throw new Error("boom");
};

type Kind = "click" | "focus" | "mouseenter";
const fire = (el: Element, type: Kind): void => {
  if (type === "click") click(el);
  else el.dispatchEvent(new Event(type, { bubbles: false }));
};

function build(type: Kind, withAncestor: boolean): () => Node {
  return () => {
    const el = document.createElement("button");
    el.id = RUNTIME_ID;
    on(el, type, boom);
    if (!withAncestor) return el;
    const root = clone(LT);
    root.appendChild(el);
    return root;
  };
}

async function run(type: Kind, withAncestor: boolean) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const { ctx, events } = observed();
  const h = inScope(() => mount(build(type, withAncestor), host, { ctx }));
  const btn = host.querySelector("button");
  if (btn === null) throw new Error("fixture: missing button");
  expect(btn.id).toBe(RUNTIME_ID);
  expect(() => fire(btn, type)).not.toThrow();
  await flush();
  const out = { events, at: first(events).data };
  h.value();
  h.dispose();
  host.remove();
  return out;
}

describe("k.errors: a handler registered with on(element, ...) on an element whose id is set at runtime throws with data.at the data-k of its nearest ancestor that has one, else the empty string", () => {
  for (const type of ["click", "focus", "mouseenter"] as const) {
    it(`${type}: data.at is the nearest ancestor's data-k, never the runtime id`, async () => {
      const r = await run(type, true);
      expect(errors(r.events)).toHaveLength(1);
      expect(first(r.events).code).toBe("keel.unexpected");
      expect(r.at).toMatchObject({ at: "list.0" });
    });
    it(`${type}: with no data-k ancestor data.at is the empty string, never the runtime id`, async () => {
      const r = await run(type, false);
      expect(errors(r.events)).toHaveLength(1);
      expect(r.at).toMatchObject({ at: "" });
    });
  }

  it('attr(el, "data-k", ...) sets nothing', async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const C = (): Node => {
      const el = document.createElement("button");
      attr(el, "data-k", () => "x");
      return el;
    };
    const h = inScope(() => mount(C, host, { ctx: observed().ctx }));
    await flush();
    const btn = host.querySelector("button");
    if (btn === null) throw new Error("fixture: missing button");
    expect(btn.getAttribute("data-k")).not.toBe("x");
    expect(btn.hasAttribute("data-k")).toBe(false);
    h.value();
    h.dispose();
    host.remove();
  });
});
