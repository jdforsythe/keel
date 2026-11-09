// Shared fixtures for std.sessions conformance. Property seed: 1337.
// The route component is built from @keel/ui elements, so its inputs go through runtime-dom's delegated listener,
// which reports each `fire` to `observe` (k.ctx). The cart store is seeded empty on every render: one store serves
// every run of a file.
import { bindStd } from "@keel/compiler/std/bindStd";
import { createCtx } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { manifest } from "@keel/router";
import type { Href } from "@keel/router";
import { s } from "@keel/schema";
import type { JsonValue, KeelError } from "@keel/schema";
import type { Session } from "@keel/std-sessions";
import { Session as SessionSchema, record } from "@keel/std-sessions";
import { store, transaction, tx } from "@keel/store";
import { renderRoute } from "@keel/testing";
import { Box, Button, Input, Link } from "@keel/ui";
import fc from "fast-check";

export const SEED = 1337;

export const simCtx = (seed = SEED): SimCtx => createCtx({ mode: "sim", seed });

const EMPTY: { items: string[]; card: string } = { items: [], card: "" };

function build() {
  const cart = store(s.object({ items: s.array(s.string()), card: s.string() }), EMPTY, { id: "cart" });
  const add = transaction(cart, "cart.add", s.object({ sku: s.string() }), (st, p) => ({
    ...st,
    items: [...st.items, p.sku],
  }));
  const pay = transaction(cart, "cart.pay", s.object({ card: s.object({ number: s.string() }) }), (st, p) => ({
    ...st,
    card: p.card.number,
  }));
  // The reload link targets this table's own route; its href exists once the table does.
  const self: { href?: Href } = {};
  const routes = manifest({
    "cart.show": {
      path: "/cart",
      component(): Node {
        return Box({
          as: "main",
          id: "cart.page",
          children: [
            Button({ id: "cart.add", children: "Add", onClick: () => void tx(add, { sku: "a" }) }),
            Input({ id: "cart.card", label: "Card", onInput: (v) => void tx(pay, { card: { number: v } }) }),
            ...(self.href === undefined ? [] : [Link({ id: "cart.reload", to: self.href, children: "Reload" })]),
          ],
        });
      },
    },
  });
  self.href = routes.href("cart.show");
  return { cart, add, pay, routes };
}

let built: ReturnType<typeof build> | undefined;

/** The fixture store, transactions and route table, built once inside a scope (a store needs an owner, E1203). */
export const fixture = (): ReturnType<typeof build> => {
  if (built !== undefined) return built;
  const made: ReturnType<typeof build>[] = [];
  scope(() => {
    made.push(build());
  });
  const [first] = made;
  if (first === undefined) throw new Error("fixture: build failed");
  built = first;
  return first;
};

/** The fixture route table. */
export const cartRoutes = () => fixture().routes;

export type Step =
  | { readonly id: "cart.add" | "cart.reload" }
  | { readonly id: "cart.card"; readonly value: string }
  | { readonly advance: number }
  | { readonly nav: true };

export const stepArb: fc.Arbitrary<Step> = fc.oneof(
  fc.constantFrom<Step>({ id: "cart.add" }, { id: "cart.reload" }, { nav: true }),
  fc.string({ maxLength: 8 }).map((value): Step => ({ id: "cart.card", value })),
  fc.integer({ min: 1, max: 500 }).map((advance): Step => ({ advance })),
);

/** One scripted run under a fresh sim ctx (config bound with `bindStd` first); returns the session and the live state. */
export async function play(
  seed: number,
  script: readonly Step[],
  options: { readonly limit?: number; readonly redact?: readonly string[] } = {},
): Promise<{ session: Session; live: Readonly<Record<string, unknown>>; ctx: SimCtx; times: number[] }> {
  const ctx = simCtx(seed);
  if (options.redact !== undefined) bindStd(ctx, { "@keel/std-sessions": { cart: { redact: [...options.redact] } } });
  const rec = record(ctx, options.limit === undefined ? {} : { limit: options.limit });
  const { cart, routes } = fixture();
  const h = await renderRoute("cart.show", { routes, ctx, state: [[cart, EMPTY]] });
  const times: number[] = [];
  for (const step of script) {
    if ("advance" in step) {
      ctx.clock.advance(step.advance);
      continue;
    }
    if ("nav" in step) {
      await h.navigate(routes.href("cart.show"));
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
export const pay = transaction(cart, 'cart.pay', s.object({ card: s.object({ number: s.string() }) }), (st, p) => ({ ...st, card: p.card.number }))
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
