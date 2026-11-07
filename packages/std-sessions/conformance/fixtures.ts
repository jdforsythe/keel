// Shared fixtures for std.sessions conformance. Property seed: 1337.
// Assumptions (spec leaves open): a route component is `(props, slots, ctx) => Node`; a click on an `<a href>` in the
// route navigates through the router (the harness has no `navigate`).
import fc from "fast-check";
import { createCtx } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { s } from "@keel/schema";
import type { KeelError, JsonValue } from "@keel/schema";
import { store, transaction, tx } from "@keel/store";
import type { Session } from "@keel/std-sessions";
import { Session as SessionSchema, record } from "@keel/std-sessions";
import { renderRoute } from "@keel/testing";

export const SEED = 1337;

export const simCtx = (seed = SEED): SimCtx => createCtx({ mode: "sim", seed });

function build() {
  const cart = store(
    s.object({ items: s.array(s.string()), card: s.string() }),
    { items: [], card: "" },
    { id: "cart" },
  );
  const add = transaction(cart, "add", s.object({ sku: s.string() }), (st, p) => ({
    ...st,
    items: [...st.items, p.sku],
  }));
  const pay = transaction(cart, "pay", s.object({ card: s.object({ number: s.string() }) }), (st, p) => ({
    ...st,
    card: p.card.number,
  }));
  const routes = manifest({
    "cart.show": {
      path: "/cart",
      component(): Node {
        const root = document.createElement("div");
        const addBtn = document.createElement("button");
        addBtn.id = "cart.add";
        addBtn.setAttribute("data-k", "cart.add");
        addBtn.addEventListener("click", () => void tx(add, { sku: "a" }));
        const input = document.createElement("input");
        input.id = "cart.card";
        input.setAttribute("data-k", "cart.card");
        input.addEventListener("input", () => void tx(pay, { card: { number: input.value } }));
        const link = document.createElement("a");
        link.id = "cart.reload";
        link.setAttribute("data-k", "cart.reload");
        link.setAttribute("href", "/cart");
        root.append(addBtn, input, link);
        return root;
      },
    },
  });
  return { cart, add, pay, routes };
}

let built: ReturnType<typeof build> | undefined;

/** The fixture store, transactions and route table, built on first use (a store made at import is outside any scope, E1203). */
export const fixture = () => {
  built ??= build();
  return built;
};

/** The fixture route table. */
export const cartRoutes = () => fixture().routes;

export type Step =
  | { readonly id: "cart.add" | "cart.reload" }
  | { readonly id: "cart.card"; readonly value: string }
  | { readonly advance: number };

export const stepArb: fc.Arbitrary<Step> = fc.oneof(
  fc.constantFrom<Step>({ id: "cart.add" }, { id: "cart.reload" }),
  fc.string({ maxLength: 8 }).map((value): Step => ({ id: "cart.card", value })),
  fc.integer({ min: 1, max: 500 }).map((advance): Step => ({ advance })),
);

/** One scripted run under a fresh sim ctx; returns the session and the live state. */
export async function play(
  seed: number,
  script: readonly Step[],
  options: { readonly limit?: number } = {},
): Promise<{ session: Session; live: Readonly<Record<string, unknown>>; ctx: SimCtx; times: number[] }> {
  const ctx = simCtx(seed);
  const rec = record(ctx, options);
  const h = await renderRoute("cart.show", { routes: cartRoutes(), ctx });
  const times: number[] = [];
  for (const step of script) {
    if ("advance" in step) {
      ctx.clock.advance(step.advance);
      continue;
    }
    if (step.id === "cart.card") await h.fire(step.id, { type: "input", value: step.value });
    else await h.fire(step.id, { type: "click" });
    times.push(ctx.clock.now());
  }
  const live = h.state();
  const session = rec.stop();
  h.dispose();
  return { session, live, ctx, times };
}

export const json = (v: Session): string => JSON.stringify(SessionSchema.encode(v));

export const isKeelError = (e: unknown): e is KeelError<string, JsonValue> =>
  typeof e === "object" && e !== null && "code" in e && "data" in e;

/** Source files of an app module `cart` with a store and a transaction, listing `redact` for sessions. */
export const cartModuleFiles = (redact: readonly string[], deps: readonly string[] = ["@keel/std-sessions"]) => [
  {
    path: "modules/cart/module.ts",
    source: `import { module } from '@keel/compiler'
export default module({
  id: 'cart',
  deps: ${JSON.stringify(deps)},
  capabilities: [],
  public: { exports: [], routes: [] },
  std: { '@keel/std-sessions': { redact: ${JSON.stringify(redact)} } },
})
`,
  },
  {
    path: "modules/cart/cart.ts",
    source: `import { s } from '@keel/schema'
import { store, transaction } from '@keel/store'
export const cart = store(s.object({ card: s.string() }), { card: '' }, { id: 'cart' })
export const pay = transaction(cart, 'pay', s.object({ card: s.object({ number: s.string() }) }), (st, p) => ({ ...st, card: p.card.number }))
`,
  },
];

export const topologySource = (adapter: "node" | "static" | "client"): { path: string; source: string } => ({
  path: "topology.ts",
  source: `import { topology } from '@keel/server'
export default topology({ web: { modules: ['cart'], adapter: '${adapter}' } })
`,
});

export const diagCodes = (r: { readonly diagnostics: readonly { readonly code: string }[] }): string[] =>
  r.diagnostics.map((d) => d.code);
