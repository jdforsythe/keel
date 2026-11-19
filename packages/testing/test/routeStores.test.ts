// @vitest-environment happy-dom
// Spec: k.testing Harness (`renderRoute`): loaders and actions naming `stores` run their factories over `ctx.storage`
// as a `node` deployable does, each navigation or submit one request; an `ok` saves (a stale read is `keel.conflict`),
// `err` or a throw saves nothing; `state()` holds no factory store. Seed: 1337.
import { type Ctx, type CtxEvent, createCtx, observe } from "@keel/ctx";
import { Form, action, loader, manifest } from "@keel/router";
import type { RouteProps } from "@keel/router";
import { text } from "@keel/runtime-dom/ops";
import { err, ok, s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import { serverState } from "@keel/store/internal";
import { renderRoute } from "@keel/testing";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const KEY = "keel.store.rs.notes";
const Notes = s.object({ items: s.array(s.string()) });
const Add = s.object({ text: s.string() });
const Boom = s.error("rs.boom", s.object({}));
const mode: { act: "ok" | "err" | "throw"; hold: Promise<void> | null; arrived: (() => void) | null } = {
  act: "ok",
  hold: null,
  arrived: null,
};

const factory = () => {
  const notes = store(Notes, { items: [] }, { id: "rs.notes" });
  const add = transaction(notes, "rs.add", Add, (st, { text: t }) => ({ items: [...st.items, t] }));
  return { notes, add };
};
const el = (tag: string, id: string): HTMLElement => {
  const e = document.createElement(tag);
  e.id = id;
  return e;
};
const itemsOf = (data: unknown): readonly string[] => {
  const items: unknown = typeof data === "object" && data !== null ? Reflect.get(data, "items") : undefined;
  return Array.isArray(items) ? items.filter((i): i is string => typeof i === "string") : [];
};
const links = manifest({ "rs.link": { path: "/rs", component: () => el("p", "rs.link") } });
const page = (props: RouteProps): Node => {
  const box = el("div", "rs.page");
  const list = el("p", "rs.items");
  text(list, () => itemsOf(props.data).join(","));
  const input = el("input", "rs.text");
  input.setAttribute("name", "text");
  input.setAttribute("aria-label", "Note");
  const button = el("button", "rs.save");
  button.setAttribute("type", "submit");
  button.textContent = "Save";
  const form = Form({
    method: "POST",
    action: links.href("rs.link"),
    error: (e) => {
      const p = el("p", "rs.err");
      p.textContent = e.code;
      return p;
    },
    children: () => [input, button],
  });
  form.id = "rs.form";
  box.append(list, form);
  return box;
};
const routes = manifest({
  "rs.page": {
    path: "/rs",
    loader: loader({ output: Notes, stores: factory }, async ({ stores }) =>
      ok({ items: [...stores.notes.get("items")] }),
    ),
    component: page,
  },
  "rs.other": { path: "/rs-other", component: () => el("p", "rs.other") },
});
routes.actions({
  "rs.page": {
    POST: action({ input: Add, stores: factory }, async ({ text: t }, { stores }) => {
      tx(stores.add, { text: t });
      mode.arrived?.();
      if (mode.hold !== null) await mode.hold;
      if (mode.act === "throw") throw new Error("boom");
      return mode.act === "err" ? err(Boom.make({})) : ok(null);
    }),
  },
});

const sim = (): Ctx => createCtx({ mode: "sim", seed: SEED });
const saved = async (ctx: Ctx): Promise<readonly string[] | null> => {
  const raw = await ctx.storage.get(KEY);
  return raw === null ? null : itemsOf(Reflect.get(Object(JSON.parse(raw)), "state"));
};
const reset = (): void => {
  mode.act = "ok";
  mode.hold = null;
  mode.arrived = null;
};

describe("renderRoute with server stores", () => {
  it("shows the snapshot ctx.storage holds; a Form submit saves, reports save, and the loaders read it", async () => {
    reset();
    const ctx = sim();
    await ctx.storage.set(KEY, JSON.stringify({ state: { items: ["seed"] }, log: [], initial: { items: ["seed"] } }));
    const events: CtxEvent[] = [];
    const stop = observe(ctx, (e) => {
      if (e.kind === "save") events.push(e);
    });
    const h = await renderRoute("rs.page", { routes, ctx });
    expect(h.find("rs.items").text).toBe("seed");
    await h.fire("rs.text", { type: "input", value: "two" });
    await h.fire("rs.form", { type: "submit" });
    expect(await saved(ctx)).toEqual(["seed", "two"]);
    expect(h.find("rs.items").text).toBe("seed,two");
    expect(events).toEqual([{ kind: "save", store: "rs.notes", head: 1, from: 0 }]);
    expect(Object.keys(h.state())).not.toContain("rs.notes");
    h.dispose();
    stop();
    expect(await saved(ctx)).toEqual(["seed", "two"]);
  });

  it("starts each factory store at its initial state on empty storage", async () => {
    reset();
    const h = await renderRoute("rs.page", { routes, ctx: sim() });
    expect(h.find("rs.items").text).toBe("");
    h.dispose();
  });

  for (const act of ["err", "throw"] as const)
    it(`saves nothing after an action ${act}`, async () => {
      reset();
      const ctx = sim();
      const h = await renderRoute("rs.page", { routes, ctx });
      mode.act = act;
      await h.fire("rs.text", { type: "input", value: "x" });
      await h.fire("rs.form", { type: "submit" }).catch(() => undefined);
      expect(await ctx.storage.get(KEY)).toBeNull();
      h.dispose();
    });

  it("answers keel.conflict when another request saved the store after the submit read it", async () => {
    reset();
    const ctx = sim();
    const h = await renderRoute("rs.page", { routes, ctx });
    let release = (): void => undefined;
    mode.hold = new Promise<void>((r) => {
      release = r;
    });
    const arrived = new Promise<void>((r) => {
      mode.arrived = r;
    });
    await h.fire("rs.text", { type: "input", value: "late" });
    const pending = h.fire("rs.form", { type: "submit" });
    await arrived;
    await saveThroughRunner(ctx, "early");
    release();
    await pending;
    expect(h.find("rs.err").text).toBe("keel.conflict");
    expect(await saved(ctx)).toEqual(["early"]);
    h.dispose();
  });

  it("runs each navigation as one request that reads another request's save", async () => {
    reset();
    const ctx = sim();
    const h = await renderRoute("rs.page", { routes, ctx });
    await saveThroughRunner(ctx, "elsewhere");
    expect(h.find("rs.items").text).toBe("");
    await h.navigate(routes.href("rs.other"));
    await h.navigate(routes.href("rs.page"));
    expect(h.find("rs.items").text).toBe("elsewhere");
    h.dispose();
  });
});

/** A second request over `ctx` through the runner (`serverState`), as `createApp` on the same ctx makes. */
async function saveThroughRunner(ctx: Ctx, t: string): Promise<void> {
  const rq = serverState(ctx).request();
  const made = await rq.stores(factory);
  if (!isFactoryValue(made)) throw new Error("not the factory's value");
  tx(made.add, { text: t });
  expect(await rq.save()).toBeNull();
  rq.end();
}
function isFactoryValue(v: unknown): v is ReturnType<typeof factory> {
  return typeof v === "object" && v !== null && "add" in v && "notes" in v;
}
