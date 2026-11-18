// @vitest-environment happy-dom
// Spec: k.owner, Owners "The generated resume, client and shell entries make the page ctx with no `signal`: it lives as long as the page. A server's ctx (`createApp`, `keel dev`, `server.mjs`) has no window and takes none. `@keel/std-sessions`' real and shell sinks make a ctx only for `random`, with `AbortSignal.abort()`, so it adds no listener. A test making real ctxs under one window passes a `signal` and aborts it when done. An object literal typed `Ctx` (a test's wrapper) lists `clock`, `random`, `net` and `storage`."
// Spec: k.owner, Conformance "A served page of two islands resumed with the generated entry under a stub `window`: when one island's component has run with its `ctx`, a dispatched `offline` still reaches `observe` as one `net` event."
// Seed 1337 (no generated inputs). A served page of two islands from `createApp`, resumed with the public `resume` on a
// real ctx made as the generated entry makes it (`createCtx({ mode: "real" })`, no `signal`) under a stub `window`.
// Untestable here: the generated client and shell entries (no public way to run them); only the resume entry is served.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { type CtxEvent, createCtx, observe } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import type { RouteProps } from "@keel/router";
import { resume } from "@keel/runtime-dom/ops";
import { ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { install, serve } from "./resume-app.ts";

const SEED = 1337;

/** A window that is an `EventTarget`: listeners the ctx adds can be dispatched to. */
class StubWindow extends EventTarget {}

const probe = (k: string): string => `import { signal } from "@keel/reactive";
export default function Island(props, slots, ctx) {
  const n = signal(0);
  const names = [];
  for (let o = ctx; o !== null && o !== undefined && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
    for (const key of Object.getOwnPropertyNames(o)) names.push(key);
  }
  document.body.setAttribute("data-ctx-${k}", names.join(","));
  return <div id="${k}.root"><button id="${k}.inc" onClick={() => n.set(n.get() + 1)}>+</button><span id="${k}.out">{n.get()}</span></div>
}
`;

type Island = (props: RouteProps, slots?: unknown, ctx?: ReturnType<typeof createCtx>) => Node;

/** A component compiled from `source` that passes its second and third arguments through. */
function compileIsland(name: string, source: string): Island {
  const r = compile([{ path: `${name}.tsx`, source }]);
  expect(r.diagnostics).toEqual([]);
  const out = r.outputs[0];
  if (out === undefined) throw new Error("fixture: no compiler output");
  const fn = evaluate(out.code);
  if (typeof fn !== "function") throw new Error("fixture: default export is not a component");
  return (props, slots, ctx) => {
    const node: unknown = fn(props, slots, ctx);
    if (!(node instanceof Node)) throw new Error("fixture: component did not return a Node");
    return node;
  };
}

const LEVELS = [
  { id: "own.layout", source: probe("a").replace("</div>", "{props.children()}</div>"), title: "T" },
  { id: "own.page", source: probe("b"), path: "/p", layout: "own.layout", title: "P" },
] as const;

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  for (const k of ["a", "b"]) document.body.removeAttribute(`data-ctx-${k}`);
});

/** Serves the page, then resumes it on a real ctx made under a stub `window`; returns the window and what `observe` saw. */
async function resumed() {
  const doc = await serve(LEVELS, "/p");
  expect(doc.status).toBe(200);
  for (const k of ["a", "b"]) document.body.removeAttribute(`data-ctx-${k}`);
  install(doc);
  const host = globalThis.window;
  const win = new StubWindow();
  const nav = { onLine: true };
  vi.stubGlobal("navigator", nav);
  vi.stubGlobal("window", win);
  const ctx = createCtx({ mode: "real", seed: SEED });
  vi.stubGlobal("window", host);
  const seen: CtxEvent[] = [];
  observe(ctx, (e) => void seen.push(e));
  const components = {
    "own.layout": compileIsland("own.layout", LEVELS[0].source),
    "own.page": compileIsland("own.page", LEVELS[1].source),
  };
  resume(document.body, components, { ctx, mode: "dev" });
  return { win, nav, ctx, seen };
}

const nets = (events: readonly CtxEvent[]) => events.filter((e) => e.kind === "net");

describe("k.owner: a served page of two islands resumed with a real ctx", () => {
  it("when one island's component has run with its `ctx`, a dispatched `offline` still reaches `observe` as one `net` event", async () => {
    const { win, nav, seen } = await resumed();
    expect(document.body.getAttribute("data-ctx-a")).not.toBeNull();
    expect(document.body.getAttribute("data-ctx-b")).not.toBeNull();
    nav.onLine = false;
    win.dispatchEvent(new Event("offline"));
    expect(nets(seen)).toEqual([{ kind: "net", online: false }]);
  });

  it("a dispatched `online` after the `offline` reaches `observe` as a second `net` event", async () => {
    const { win, nav, seen } = await resumed();
    nav.onLine = false;
    win.dispatchEvent(new Event("offline"));
    nav.onLine = true;
    win.dispatchEvent(new Event("online"));
    expect(nets(seen)).toEqual([
      { kind: "net", online: false },
      { kind: "net", online: true },
    ]);
  });

  it("the ctx an island's component receives has no `dispose`, and no own or inherited member is named `dispose`", async () => {
    await resumed();
    for (const k of ["a", "b"]) {
      const names = (document.body.getAttribute(`data-ctx-${k}`) ?? "").split(",");
      expect(names).toContain("clock");
      expect(names).toContain("storage");
      expect(names).not.toContain("dispose");
    }
  });

  it("the page's ctx has no `dispose` after both islands have rendered", async () => {
    const { ctx } = await resumed();
    expect("dispose" in ctx).toBe(false);
  });

  it("an island that clicks does not end connectivity reporting: after the click a dispatched `offline` still reaches `observe`", async () => {
    const { win, nav, seen } = await resumed();
    document.getElementById("a.inc")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    document.getElementById("b.inc")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    for (let i = 0; i < 8; i++) await Promise.resolve();
    nav.onLine = false;
    win.dispatchEvent(new Event("offline"));
    expect(nets(seen)).toEqual([{ kind: "net", online: false }]);
  });
});

describe("k.owner: the generated resume entry makes the page ctx with no `signal`", () => {
  const Data = s.object({ title: s.string() });
  const pageLoader = loader({ output: Data }, () => Promise.resolve(ok({ title: "T" })));

  async function entrySource(): Promise<string> {
    const app = await createApp({
      topology: topology({ web: { modules: ["own"], adapter: "node" } }),
      routes: manifest({
        "own.page": { path: "/p", component: compileIsland("own.page", probe("b")), loader: pageLoader },
      }),
      ctx: createCtx({ mode: "sim", seed: SEED }),
      mode: "production",
    });
    const res = await app.fetch(new Request("http://localhost/p", { headers: { accept: "text/html" } }));
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const src = doc.querySelector('script[type="module"]')?.getAttribute("src");
    if (src === null || src === undefined) throw new Error("fixture: no module script");
    const entry = await app.fetch(new Request(new URL(src, "http://localhost")));
    expect(entry.status).toBe(200);
    return entry.text();
  }

  it("the entry's `createCtx` call names no `signal` and the entry has no `dispose`", async () => {
    const body = await entrySource();
    const call = /createCtx\(([^)]*)\)/.exec(body);
    expect(call).not.toBeNull();
    expect(call?.[1] ?? "").not.toContain("signal");
    expect(body).not.toContain("dispose");
  });
});
