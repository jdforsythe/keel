// @vitest-environment happy-dom
// Spec: k.runtime, clause "An observer on the resume ctx gets the served `nav`, an `input` for a field typed before load, then each queued event, once."
// Seed 1337
// ASSUMPTION: resume(root, components, { ctx }); observe(ctx, fn) registered before resume still gets nav first (k.ctx).
import { type CtxEvent, createCtx, observe } from "@keel/ctx";
import { clone, on, resume, template } from "@keel/runtime-dom/ops";
import { describe, expect, it } from "vitest";
import { click } from "./fixtures.ts";

const HTML =
  '<div data-k-island="Form"><input id="name" data-k="name" value="a"><button id="inc" data-k="inc">go</button></div>';
const FormT = template(HTML);

const seen: { input: string[]; clicks: number } = { input: [], clicks: 0 };
const Form = (): Node => {
  const root = clone(FormT);
  on("name", "input", (e: Event) => {
    if (e.target instanceof HTMLInputElement) seen.input.push(e.target.value);
  });
  on("inc", "click", () => {
    seen.clicks += 1;
  });
  return root;
};

const kstate = (route?: unknown): string =>
  `<script type="application/json" id="k-state">${JSON.stringify({
    stores: {},
    islands: { Form: {} },
    ...(route === undefined ? {} : { route }),
  })}</script>`;
const ROUTE = { id: "home", path: "/", href: "/", params: {}, search: {} };

const setup = (state: string) => {
  seen.input = [];
  seen.clicks = 0;
  const host = document.createElement("div");
  document.body.appendChild(host);
  host.innerHTML = HTML + state;
  const input = host.querySelector("#name");
  const btn = host.querySelector("#inc");
  if (!(input instanceof HTMLInputElement) || btn === null) throw new Error("fixture: missing controls");
  const ctx = createCtx({ seed: 1, mode: "sim" });
  const events: CtxEvent[] = [];
  observe(ctx, (e) => {
    events.push(e);
  });
  return { host, input, btn, ctx, events };
};

describe("k.runtime: an observer on the resume ctx gets the served nav, an input for a field typed before load, then each queued event, once", () => {
  it("an observer on the resume ctx gets the served `nav`, an `input` for a field typed before load, then each queued event, once", () => {
    const { host, input, btn, ctx, events } = setup(kstate(ROUTE));
    input.value = "typed";
    click(btn);
    resume(host, { Form }, { ctx });
    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({
      kind: "nav",
      href: "/",
      route: { id: "home", path: "/", params: {}, search: {} },
    });
    expect(events[1]).toMatchObject({ kind: "fire", id: "name", event: { type: "input", value: "typed" } });
    expect(events[2]).toMatchObject({ kind: "fire", id: "inc", event: { type: "click" } });
    expect(seen.input).toEqual(["typed"]);
    expect(seen.clicks).toBe(1);
    host.remove();
  });

  it("a control whose value equals its default produces no `input` event", () => {
    const { host, btn, ctx, events } = setup(kstate(ROUTE));
    click(btn);
    resume(host, { Form }, { ctx });
    expect(events.map((e) => e.kind)).toEqual(["nav", "fire"]);
    expect(events.some((e) => e.kind === "fire" && e.event.type === "input")).toBe(false);
    expect(seen.input).toEqual([]);
    host.remove();
  });

  it("with no `route` in `#k-state`, no `nav` is reported", () => {
    const { host, input, ctx, events } = setup(kstate());
    input.value = "typed";
    resume(host, { Form }, { ctx });
    expect(events.some((e) => e.kind === "nav")).toBe(false);
    expect(events).toHaveLength(1);
    host.remove();
  });
});
