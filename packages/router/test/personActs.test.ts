// @vitest-environment happy-dom
// k.opening Link-started on a router of a shell's ctx (`mountRequests`, `personActs`): which events are a person's act,
// that a taken link makes the ctx link-started until the next act, per ctx, and that the state is read as the browser
// opens. The shell here never reports its launch (k.links Launch), so an opening before any act is held, never stored.
// happy-dom dispatches no trusted event, so a trusted one is made by defining `isTrusted` on the instance.
// Seed 1337 for the properties.
import { type SimCtx, createCtx } from "@keel/ctx";
import { contract } from "@keel/router/contract";
import { mount } from "@keel/runtime-dom";
import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Form } from "../src/Form.ts";
import { identityMount } from "../src/identityMount.ts";
import { createRouterWith } from "../src/internal/createRouterWith.ts";
import { mountRequests } from "../src/internal/mountRequests.ts";
import { personActs } from "../src/internal/personActs.ts";
import { manifest } from "../src/manifest.ts";
import { memoryHistory } from "./memoryHistory.ts";

const auth = identityMount("/auth");
const ID = "dev.keel.app";
const PROVIDER = "https://provider.example/a";
const settle = async (): Promise<void> => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};
const to = (status: number, location: string): Response => new Response(null, { status, headers: { location } });

/** Whether an opening the page's code makes now is recorded: a person has acted and the ctx is not link-started. */
const records = (ctx: SimCtx): boolean => personActs.of(ctx).acted && !personActs.of(ctx).linked;

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
});

/** `e` as the browser dispatches a person's input: trusted. */
function trusted<E extends Event>(e: E): E {
  Object.defineProperty(e, "isTrusted", { value: true });
  return e;
}

/**
 * A shell page whose `/auth/start` answers 302 to the provider (an opening) and whose callback answers 303 to `/`;
 * `hold` keeps the start's answer until `release`. `callbacks()` counts the admitted links.
 */
function shell(opts: { hold?: boolean } = {}) {
  const ctx: SimCtx = createCtx({ mode: "sim", seed: 1337 });
  const sent: string[] = [];
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  ctx.net.route("*", async (req) => {
    const u = new URL(req.url);
    sent.push(u.pathname);
    if (u.pathname === "/auth/start") {
      if (opts.hold === true) await held;
      return to(302, PROVIDER);
    }
    return to(303, "/");
  });
  const opened: string[] = [];
  const { link } = mountRequests(ctx, { id: ID, open: (url) => void opened.push(url), mounts: [auth] });
  const home = (): Node => {
    const box = document.createElement("div");
    const field = document.createElement("input");
    field.id = "field";
    const a = document.createElement("a");
    a.id = "start";
    a.href = auth.href("/start");
    const button = document.createElement("button");
    button.type = "submit";
    box.append(field, a, Form({ method: "POST", action: auth.href("/start"), children: () => [button] }));
    return box;
  };
  const routes = manifest(contract("t", { "t.home": { path: "/" } }), { "t.home": { component: home } });
  const router = createRouterWith(routes, { ctx, history: memoryHistory("/"), leave: () => undefined });
  const h = document.createElement("div");
  document.body.append(h);
  const unmount = mount(router.App, h, { ctx });
  stops.push(() => {
    unmount();
    router.dispose();
    h.remove();
  });
  const start = async (): Promise<void> => {
    await router.navigate(auth.href("/start"));
    await settle();
  };
  const callback = async (): Promise<void> => {
    await link(`${ID}:/auth/callback`);
    await settle();
  };
  const callbacks = (): number => sent.filter((u) => u === "/auth/callback").length;
  return { ctx, sent, opened, h, start, callback, callbacks, release };
}

type Input = "pointerdown" | "pointerup" | "mousedown" | "touchend" | "keydown";
const INPUTS: readonly Input[] = ["pointerdown", "pointerup", "mousedown", "touchend", "keydown"];
const eventOf = (type: Input, key = "a"): Event =>
  type === "keydown" ? new KeyboardEvent(type, { bubbles: true, key }) : new Event(type, { bubbles: true });

describe("a person's act (k.opening Link-started)", () => {
  it("each trusted activation input on the page is an act: the next opening admits one link", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...INPUTS), fc.boolean(), async (type, onField) => {
        const t = shell();
        const target = onField ? t.h.querySelector("#field") : document;
        target?.dispatchEvent(trusted(eventOf(type)));
        await t.start();
        expect(t.opened).toEqual([PROVIDER]);
        await t.callback();
        expect(t.callbacks()).toBe(1);
        for (const stop of stops.splice(0)) stop();
      }),
      { seed: 1337, numRuns: 20 },
    );
  });

  it("untrusted input, a trusted Escape, and a trusted click or submit with no input are none: the browser opens and admits no link", async () => {
    const cases: ((t: ReturnType<typeof shell>) => void)[] = [
      ...INPUTS.map((type) => (t: ReturnType<typeof shell>) => void t.h.dispatchEvent(eventOf(type))),
      (t) => void document.dispatchEvent(trusted(eventOf("keydown", "Escape"))),
      (t) => void t.h.querySelector("#field")?.dispatchEvent(trusted(eventOf("keydown", "Escape"))),
      (t) => void t.h.querySelector("#field")?.dispatchEvent(trusted(new MouseEvent("click", { bubbles: true }))),
      (t) => void t.h.querySelector("form")?.dispatchEvent(trusted(new Event("submit", { bubbles: true }))),
    ];
    for (const [i, act] of cases.entries()) {
      const t = shell();
      act(t);
      await t.start();
      // The trusted submit of the mount form is itself a mount request that opens the browser.
      expect(t.opened.at(-1), String(i)).toBe(PROVIDER);
      await t.callback();
      expect(t.callbacks(), String(i)).toBe(0);
      for (const stop of stops.splice(0)) stop();
    }
  });

  it("a script's click() on a mount link and requestSubmit() of a mount form open the browser and admit no link", async () => {
    const clicked = shell();
    const a = clicked.h.querySelector("#start");
    if (a instanceof HTMLAnchorElement) a.click();
    await settle();
    expect(clicked.opened).toEqual([PROVIDER]);
    await clicked.callback();
    expect(clicked.callbacks()).toBe(0);
    for (const stop of stops.splice(0)) stop();
    const submitted = shell();
    const form = submitted.h.querySelector("form");
    if (form instanceof HTMLFormElement) form.requestSubmit();
    await settle();
    expect(submitted.sent).toEqual(["/auth/start"]);
    await submitted.callback();
    expect(submitted.callbacks()).toBe(0);
  });

  it("a page handler that stops the input does not hide it: the router listens first, in the capture phase", async () => {
    const t = shell();
    const field = t.h.querySelector("#field");
    field?.addEventListener("pointerdown", (e) => e.stopImmediatePropagation(), { capture: true });
    document.addEventListener("pointerdown", (e) => e.stopPropagation(), { capture: true });
    field?.dispatchEvent(trusted(eventOf("pointerdown")));
    await t.start();
    await t.callback();
    expect(t.callbacks()).toBe(1);
  });
});

describe("the act's lifetime (k.opening Link-started)", () => {
  it("an admitted link makes the ctx link-started until the next act; a refused link does not", async () => {
    const t = shell();
    document.dispatchEvent(trusted(eventOf("pointerdown")));
    // Refused: no opening is pending yet, so the act stays.
    await t.callback();
    expect(t.callbacks()).toBe(0);
    expect(records(t.ctx)).toBe(true);
    await t.start();
    await t.callback();
    expect(t.callbacks()).toBe(1);
    expect(records(t.ctx)).toBe(false);
    // Admitted: the next opening the page's code starts records nothing until a person acts again.
    await t.start();
    expect(t.opened).toEqual([PROVIDER, PROVIDER]);
    await t.callback();
    expect(t.callbacks()).toBe(1);
    document.dispatchEvent(trusted(eventOf("keydown")));
    await t.start();
    await t.callback();
    expect(t.callbacks()).toBe(2);
  });

  it("two ctxs hold their own state: an act or a link in one leaves the other", () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.boolean(), fc.boolean()), { maxLength: 12 }), (ops) => {
        const a = createCtx({ mode: "sim", seed: 1337 });
        const b = createCtx({ mode: "sim", seed: 1337 });
        const model = { a: false, b: false };
        for (const [first, mark] of ops) {
          const ctx = first ? a : b;
          if (mark) personActs.fired(ctx, { type: "click" });
          else personActs.of(ctx).linked = true;
          model[first ? "a" : "b"] = mark;
          expect([records(a), records(b)]).toEqual([model.a, model.b]);
        }
      }),
      { seed: 1337, numRuns: 50 },
    );
  });

  it("a new ctx starts with no act, and the act is never stored", async () => {
    const t = shell();
    const set = vi.spyOn(t.ctx.storage, "set");
    const commit = vi.spyOn(t.ctx.storage, "commit");
    document.dispatchEvent(trusted(eventOf("pointerdown")));
    await t.start();
    await t.callback();
    document.dispatchEvent(trusted(eventOf("keydown")));
    const keys = [...set.mock.calls.map((c) => c[0]), ...commit.mock.calls.flatMap((c) => c[0].map((w) => w.key))];
    expect(new Set(keys)).toEqual(new Set(["keel.return"]));
    expect(records(createCtx({ mode: "sim", seed: 1337 }))).toBe(false);
  });

  it("listeners are attached once per ctx, however often mountRequests runs for it", () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const add = vi.spyOn(window, "addEventListener");
    mountRequests(ctx, { id: ID, open: () => undefined, mounts: [auth] });
    const first = add.mock.calls.length;
    mountRequests(ctx, { id: ID, open: () => undefined, mounts: [auth] });
    mountRequests(ctx, { id: ID, open: () => undefined, mounts: [auth] });
    const types = add.mock.calls.map((c) => c[0]);
    const total = add.mock.calls.length;
    add.mockRestore();
    expect(types.filter((x) => x === "pointerdown")).toHaveLength(1);
    expect(total).toBe(first);
  });
});

describe("the act is read as the browser opens (k.opening Link-started)", () => {
  it("an act between the chain's start and its opening records the opening", async () => {
    const t = shell({ hold: true });
    const started = t.start();
    await settle();
    expect(t.opened).toEqual([]);
    document.dispatchEvent(trusted(eventOf("touchend")));
    t.release();
    await started;
    await settle();
    expect(t.opened).toEqual([PROVIDER]);
    await t.callback();
    expect(t.callbacks()).toBe(1);
  });

  it("a link that takes an opening while a chain is in flight makes that chain's opening unrecorded", async () => {
    const t = shell({ hold: true });
    document.dispatchEvent(trusted(eventOf("mousedown")));
    await t.ctx.storage.set("keel.return", JSON.stringify({ deadline: t.ctx.clock.now() + 600000 }));
    const started = t.start();
    await settle();
    await t.callback();
    expect(t.callbacks()).toBe(1);
    t.release();
    await started;
    await settle();
    expect(t.opened).toEqual([PROVIDER]);
    await t.callback();
    expect(t.callbacks()).toBe(1);
  });
});
