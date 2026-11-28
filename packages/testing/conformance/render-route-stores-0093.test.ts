// @vitest-environment happy-dom
// Spec: k.testing, clause "`renderRoute` of a page whose loader names `stores` shows the snapshot `ctx.storage` holds; a `Form` submit to its `stores` action saves, and the page's loaders then read the saved state."
// k.testing, Harness `renderRoute`: a loader's or action's `stores` run over `ctx.storage`, a navigation or submit one request; an action's `err` or a throw saves nothing; a stale read is `keel.conflict`; `state` and `state()` hold no factory store. k.server Server state: client routers (the public `createRouter`) refuse `stores`.
// Seed: 1337.
// The stale-read clause (`keel.conflict`) is tested in packages/server/conformance/render-route-shared-copy-0093.test.ts: a competing write needs a second writer, and `createApp` on the same ctx is the only public non-rendering one.
// ASSUMPTIONS (spec names no shape): a harness submit is `fire(inputId, { type: 'input', value })` then `fire(formId, { type: 'submit' })`;
// server state is seeded through a first harness on the same ctx (the stored snapshot format is the runner's own);
// the public router's refusal shows as `keel.unexpected` in the route's `errorElement`.
import type { Ctx } from "@keel/ctx";
import { Form, action, createRouter, loader, manifest } from "@keel/router";
import type { RouteProps } from "@keel/router";
import { contract } from "@keel/router/contract";
import { mount } from "@keel/runtime-dom";
import { text } from "@keel/runtime-dom/ops";
import { err, ok, s } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import { renderRoute } from "@keel/testing";
import { Input } from "@keel/ui";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, simCtx, thrown } from "./fixtures.ts";

const KEY = "keel.store.st.notes";
const Notes = s.object({ items: s.array(s.string()) });
const Add = s.object({ text: s.string() });
const Boom = s.error("st.boom", s.object({}));

const hops = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};

const control: { mode: "ok" | "err" | "throw"; loads: number } = {
  mode: "ok",
  loads: 0,
};
const reset = (): void => {
  control.mode = "ok";
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

const linkContract = contract("link", { "link.st": { path: "/st" } });
const links = manifest(linkContract, { "link.st": { component: () => el("p", "link.st") } });

const page = (props: RouteProps): Node => {
  const main = el("main", "st.page");
  const list = el("p", "st.items");
  text(list, () => itemsOf(props.data).join(","));
  const input = Input({ id: "st.text", name: "text", label: "Text" });
  const button = el("button", "st.save");
  button.setAttribute("type", "submit");
  button.textContent = "save";
  const form = Form({
    method: "POST",
    action: linkContract.href("link.st"),
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

const stContract = contract("st", { "st.page": { path: "/st" }, "st.other": { path: "/other" } });
const stContract2 = contract("st", { "st.page": { path: "/st" } });
const read = loader(stContract, "st.page", { output: Notes, stores: factory }, async ({ stores }) => {
  control.loads++;
  return ok({ items: [...stores.notes.get("items")] });
});
const write = action(stContract, "st.page", { input: Add, stores: factory }, async ({ text: t }, { stores }) => {
  tx(stores.add, { text: t });
  if (control.mode === "throw") throw new Error("boom");
  if (control.mode === "err") return err(Boom.make({}));
  return ok(null);
});
// The refusing manifest binds the same page under its own contract, so it needs its own loader and action.
const read2 = loader(stContract2, "st.page", { output: Notes, stores: factory }, async ({ stores }) => {
  control.loads++;
  return ok({ items: [...stores.notes.get("items")] });
});
const write2 = action(stContract2, "st.page", { input: Add, stores: factory }, async ({ text: t }, { stores }) => {
  tx(stores.add, { text: t });
  if (control.mode === "throw") throw new Error("boom");
  if (control.mode === "err") return err(Boom.make({}));
  return ok(null);
});
const routes = manifest(stContract, {
  "st.page": { component: page, loader: read, POST: write },
  "st.other": { component: () => el("p", "st.other") },
});
const refusing = manifest(stContract2, {
  "st.page": {
    component: page,
    loader: read2,
    errorElement: ({ error }) => {
      const p = el("p", "st.refused");
      p.textContent = error.code;
      return p;
    },
    POST: write2,
  },
});

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

/**
 * What a property case here bounds for each run: a few renderRoutes of the page and up to a dozen fires, about 20 ms
 * here on a quiet machine and up to 50 ms beside other work. The bound is 1,000 ms a run, so a runner ten times slower
 * (scale 0.1) still has 100 ms a run.
 */
const RUN_BOUND = 1_000;

test(
  "renderRoute of a page whose loader names `stores` shows the snapshot `ctx.storage` holds",
  async () => {
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
  },
  15 * RUN_BOUND,
);

test(
  "a `Form` submit to a `stores` action saves its changed stores, and the page's loaders then read the saved state",
  async () => {
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
  },
  15 * RUN_BOUND,
);

test(
  "an action's `err` or a throw saves nothing: the stored text stays as it was",
  async () => {
    await fc.assert(
      fc.asyncProperty(
        texts,
        fc.stringMatching(/^[a-z]{1,8}$/),
        fc.constantFrom<"err" | "throw">("err", "throw"),
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
  },
  10 * RUN_BOUND,
);

test(
  "a navigation is one request: each run of the loader opens its stores from `ctx.storage` and reads an earlier harness's save",
  async () => {
    await fc.assert(
      fc.asyncProperty(texts, fc.stringMatching(/^[a-z]{1,8}$/), async (values, extra) => {
        reset();
        const ctx = simCtx();
        await seeded(ctx, values);
        control.loads = 0;
        const a = await open(ctx);
        expect(control.loads).toBe(1);
        expect(a.find("st.items").text).toBe(values.join(","));
        await submit(a, extra);
        const before = control.loads;
        await a.navigate(stContract.href("st.other"));
        await a.navigate(stContract.href("st.page"));
        expect(control.loads).toBe(before + 1);
        expect(a.find("st.items").text).toBe([...values, extra].join(","));
        a.dispose();
      }),
      { seed: SEED, numRuns: 10 },
    );
  },
  10 * RUN_BOUND,
);

test("`state()` and `state(store)` hold no factory store", async () => {
  reset();
  const ctx = simCtx();
  const h = await open(ctx);
  await submit(h, "x");
  expect(Object.keys(h.state())).not.toContain("st.notes");
  h.dispose();
});

test("the public `createRouter` still refuses `stores`: the loader never runs and the page shows `keel.unexpected`", async () => {
  reset();
  const ctx = simCtx();
  const entries: string[] = ["/st"];
  const router = createRouter(refusing, {
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
  const unmount = mount(router.App, host, { ctx: simCtx() });
  await hops(50);
  expect(control.loads).toBe(0);
  expect(document.getElementById("st.items")).toBeNull();
  expect(document.getElementById("st.refused")?.textContent).toBe("keel.unexpected");
  expect(await ctx.storage.get(KEY)).toBeNull();
  unmount();
  router.dispose();
  host.remove();
});
