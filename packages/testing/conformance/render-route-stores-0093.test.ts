// @vitest-environment happy-dom
// Spec: k.testing, Conformance "`renderRoute` of a page whose loader names `stores` shows the snapshot `ctx.storage` holds; a `Form` submit to its `stores` action saves, and the page's loaders then read the saved state."
// Spec: k.testing, Harness `renderRoute`: a loader's or action's `stores` run over `ctx.storage`, a navigation or submit one request; an action's `err` or a throw saves nothing; a stale read is `keel.conflict`; `state` and `state()` hold no factory store. k.server Server state: client routers (the public `createRouter`) refuse `stores`.
// Seed: 1337.
// Skipped until the implementation exists (rfc:0093).
// ASSUMPTIONS (spec names no shape): a harness submit is `fire(inputId, { type: 'input', value })` then `fire(formId, { type: 'submit' })`;
// server state is seeded through a first harness on the same ctx (the stored snapshot format is the runner's own);
// the public router's refusal shows as `keel.unexpected` in the route's `errorElement`.
import type { Ctx } from "@keel/ctx";
import { Form, action, createRouter, loader, manifest } from "@keel/router";
import type { RouteProps } from "@keel/router";
import { mount } from "@keel/runtime-dom";
import { text } from "@keel/runtime-dom/ops";
import { err, ok, s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, simCtx, thrown } from "./fixtures.ts";

const KEY = "keel.store.st.notes";
const Notes = s.object({ items: s.array(s.string()) });
const Add = s.object({ text: s.string() });
const Boom = s.error("st.boom", s.object({}));

interface Deferred {
  readonly promise: Promise<void>;
  resolve(): void;
}
const deferred = (): Deferred => {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const hops = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};

const control: { mode: "ok" | "err" | "throw"; hold: Deferred | null; arrived: Deferred | null; loads: number } = {
  mode: "ok",
  hold: null,
  arrived: null,
  loads: 0,
};
const reset = (): void => {
  control.mode = "ok";
  control.hold = null;
  control.arrived = null;
  control.loads = 0;
};

const factory = () => {
  const notes = store(Notes, { items: [] }, { id: "st.notes" });
  const add = transaction(notes, "st.add", Add, (state, { text: t }) => ({ items: [...state.items, t] }));
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

const links = manifest({ "link.st": { path: "/st", component: () => el("p", "link.st") } });

const page = (props: RouteProps): Node => {
  const main = el("main", "st.page");
  const list = el("p", "st.items");
  text(list, () => itemsOf(props.data).join(","));
  const input = el("input", "st.text");
  input.setAttribute("name", "text");
  const button = el("button", "st.save");
  button.setAttribute("type", "submit");
  button.textContent = "save";
  const form = Form({
    method: "POST",
    action: links.href("link.st"),
    error: (e) => {
      const p = el("p", "st.err");
      p.textContent = e.code;
      return p;
    },
    children: () => [input, button],
  });
  form.id = "st.form";
  main.append(list, form);
  return main;
};

const read = loader({ output: Notes, stores: factory }, async ({ stores }) => {
  control.loads++;
  return ok({ items: [...stores.notes.get("items")] });
});
const write = action({ input: Add, stores: factory }, async ({ text: t }, { stores }) => {
  const hold = control.hold;
  control.hold = null;
  tx(stores.add, { text: t });
  control.arrived?.resolve();
  if (hold !== null) await hold.promise;
  if (control.mode === "throw") throw new Error("boom");
  if (control.mode === "err") return err(Boom.make({}));
  return ok(null);
});
const routes = manifest({
  "st.page": {
    path: "/st",
    loader: read,
    component: page,
    errorElement: ({ error }) => {
      const p = el("p", "st.refused");
      p.textContent = error.code;
      return p;
    },
  },
  "st.other": { path: "/other", component: () => el("p", "st.other") },
});
routes.actions({ "st.page": { POST: write } });

const texts = fc.array(fc.stringMatching(/^[a-z]{1,8}$/), { minLength: 1, maxLength: 4 });

type Handle = Awaited<ReturnType<typeof open>>;
const open = (ctx: Ctx) => renderRoute("st.page", { routes, ctx });
const submit = async (h: Handle, value: string): Promise<void> => {
  await h.fire("st.text", { type: "input", value });
  await h.fire("st.form", { type: "submit" });
};
const savedItems = async (ctx: Ctx): Promise<readonly string[] | null> => {
  const raw = await ctx.storage.get(KEY);
  if (raw === null) return null;
  const parsed: unknown = JSON.parse(raw);
  const state: unknown = typeof parsed === "object" && parsed !== null ? Reflect.get(parsed, "state") : undefined;
  return itemsOf(state);
};
const seeded = async (ctx: Ctx, values: readonly string[]): Promise<void> => {
  const h = await open(ctx);
  for (const v of values) await submit(h, v);
  h.dispose();
};

test.skip("renderRoute of a page whose loader names `stores` shows the snapshot `ctx.storage` holds", async () => {
  await fc.assert(
    fc.asyncProperty(texts, async (values) => {
      reset();
      const ctx = simCtx();
      const empty = await open(ctx);
      expect(empty.find("st.items").text).toBe("");
      expect(await ctx.storage.get(KEY)).toBeNull();
      empty.dispose();
      await seeded(ctx, values);
      const h = await open(ctx);
      expect(h.find("st.items").text).toBe(values.join(","));
      h.dispose();
    }),
    { seed: SEED, numRuns: 15 },
  );
});

test.skip("a `Form` submit to a `stores` action saves its changed stores, and the page's loaders then read the saved state", async () => {
  await fc.assert(
    fc.asyncProperty(texts, async (values) => {
      reset();
      const ctx = simCtx();
      const h = await open(ctx);
      for (const [i, v] of values.entries()) {
        await submit(h, v);
        expect(await savedItems(ctx)).toEqual(values.slice(0, i + 1));
        expect(h.find("st.items").text).toBe(values.slice(0, i + 1).join(","));
      }
      h.dispose();
    }),
    { seed: SEED, numRuns: 15 },
  );
});

test.skip("an action's `err` or a throw saves nothing: the stored text stays as it was", async () => {
  await fc.assert(
    fc.asyncProperty(
      texts,
      fc.stringMatching(/^[a-z]{1,8}$/),
      fc.constantFrom("err", "throw"),
      async (values, v, mode) => {
        reset();
        const ctx = simCtx();
        expect(await savedItems(ctx)).toBeNull();
        const fresh = await open(ctx);
        control.mode = mode;
        await thrown(() => submit(fresh, v));
        expect(await ctx.storage.get(KEY)).toBeNull();
        fresh.dispose();
        control.mode = "ok";
        await seeded(ctx, values);
        const before = await ctx.storage.get(KEY);
        const h = await open(ctx);
        control.mode = mode;
        await thrown(() => submit(h, v));
        expect(await ctx.storage.get(KEY)).toBe(before);
        control.mode = "ok";
        await h.settle();
        expect(h.find("st.items").text).toBe(values.join(","));
        h.dispose();
      },
    ),
    { seed: SEED, numRuns: 10 },
  );
});

test.skip("a stale read is `keel.conflict`: the later save answers the error and nothing of it is stored", async () => {
  await fc.assert(
    fc.asyncProperty(fc.stringMatching(/^[a-z]{1,8}$/), fc.stringMatching(/^[a-z]{1,8}$/), async (first, second) => {
      reset();
      const ctx = simCtx();
      const slow = await open(ctx);
      const quick = await open(ctx);
      control.hold = deferred();
      const gate = control.hold;
      control.arrived = deferred();
      const arrived = control.arrived;
      await slow.fire("st.text", { type: "input", value: first });
      const pending = slow.fire("st.form", { type: "submit" });
      await arrived.promise;
      await submit(quick, second);
      gate.resolve();
      await pending;
      expect(slow.find("st.err").text).toBe("keel.conflict");
      expect(await savedItems(ctx)).toEqual([second]);
      slow.dispose();
      quick.dispose();
    }),
    { seed: SEED, numRuns: 8 },
  );
});

test.skip("a navigation is one request: each run of the loader opens its stores from `ctx.storage` and reads another harness's save", async () => {
  await fc.assert(
    fc.asyncProperty(texts, async (values) => {
      reset();
      const ctx = simCtx();
      const a = await open(ctx);
      expect(control.loads).toBe(1);
      const b = await open(ctx);
      for (const v of values) await submit(b, v);
      const before = control.loads;
      await a.navigate(routes.href("st.other"));
      await a.navigate(routes.href("st.page"));
      expect(control.loads).toBe(before + 1);
      expect(a.find("st.items").text).toBe(values.join(","));
      a.dispose();
      b.dispose();
    }),
    { seed: SEED, numRuns: 10 },
  );
});

test.skip("`state()` and `state(store)` hold no factory store", async () => {
  reset();
  const ctx = simCtx();
  const h = await open(ctx);
  await submit(h, "x");
  expect(Object.keys(h.state())).not.toContain("st.notes");
  h.dispose();
});

test.skip("the public `createRouter` still refuses `stores`: the loader never runs and the page shows `keel.unexpected`", async () => {
  reset();
  const ctx = simCtx();
  const entries: string[] = ["/st"];
  const router = createRouter(routes, {
    ctx,
    history: {
      push: (url) => {
        entries.push(url);
      },
      replace: (url) => {
        entries[entries.length - 1] = url;
      },
      current: () => entries[entries.length - 1] ?? "/st",
      onPop: () => undefined,
    },
  });
  const host = document.createElement("div");
  document.body.append(host);
  const unmount = mount(router.App, host);
  await hops(50);
  expect(control.loads).toBe(0);
  expect(document.getElementById("st.items")).toBeNull();
  expect(document.getElementById("st.refused")?.textContent).toBe("keel.unexpected");
  expect(await ctx.storage.get(KEY)).toBeNull();
  unmount();
  router.dispose();
  host.remove();
});
