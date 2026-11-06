// Shared fixtures for k.testing conformance. Property seed: 1337.
// Assumptions (spec leaves open): a component is `(props, slots, ctx) => Node` carrying a static `Props` schema;
// `transaction(store, name, payloadSchema, fn)` binds a transaction to its store.
import type { Ctx } from "@keel/ctx";
import { createCtx } from "@keel/ctx";
import { effect, scope, signal } from "@keel/reactive";
import { attr, clone, on, template, text } from "@keel/runtime-dom/ops";
import { s } from "@keel/schema";
import { invariant, store, transaction, tx } from "@keel/store";

export const SEED = 1337;

export const simCtx = (seed = SEED) => createCtx({ mode: "sim", seed });

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

export const codeOf = (e: unknown): string | undefined => {
  if (isRecord(e) && typeof e.code === "string") return e.code;
  return undefined;
};

export const messageOf = (e: unknown): string => (isRecord(e) && typeof e.message === "string" ? e.message : String(e));

// Runs fn (sync or async) and returns what it threw, or undefined when it did not throw.
export const thrown = async (fn: () => unknown): Promise<unknown> => {
  try {
    await fn();
    return undefined;
  } catch (e) {
    return e ?? new Error("threw a falsy value");
  }
};

// Flattens an a11y tree (single node or array) into nodes, depth first.
export const flatten = (tree: unknown): Record<string, unknown>[] => {
  if (Array.isArray(tree)) return tree.flatMap(flatten);
  if (!isRecord(tree)) return [];
  const kids = Array.isArray(tree.children) ? tree.children.flatMap(flatten) : [];
  return [tree, ...kids];
};

const need = (root: Node, sel: string): Element => {
  const found = root instanceof Element ? (root.matches(sel) ? root : root.querySelector(sel)) : null;
  if (found === null) throw new Error(`fixture: template lacks ${sel}`);
  return found;
};

type Slots = Record<string, unknown> | undefined;

// <Button label="Save" disabled />
export const ButtonProps = s.object({ label: s.string(), disabled: s.boolean() });
const ButtonT = template('<button id="save" data-k="save"></button>');
export const Button = Object.assign(
  (props: { readonly label: string; readonly disabled: boolean }, _slots?: Slots, _ctx?: Ctx): Node => {
    const root = clone(ButtonT);
    const b = need(root, "#save");
    text(b, () => props.label);
    attr(b, "disabled", () => props.disabled);
    return root;
  },
  { Props: ButtonProps },
);

// Counts how many times a component body ran (for "rejects before rendering").
export const bodyRuns = { n: 0 };
export const Counted = Object.assign(
  (_props: { readonly n: number }, _slots?: Slots, _ctx?: Ctx): Node => {
    bodyRuns.n++;
    return clone(template('<p id="counted"></p>'));
  },
  { Props: s.object({ n: s.int() }) },
);

// Shows ctx.clock.now() and ctx.random.float(); #clock.read re-reads the clock.
const ClockT = template(
  '<div><p id="clock.now"></p><p id="rand"></p><button id="clock.read" data-k="clock.read">read</button></div>',
);
export const ClockView = Object.assign(
  (_props: Record<string, never>, _slots?: Slots, ctx?: Ctx): Node => {
    if (ctx === undefined) throw new Error("fixture: ctx not passed to component");
    const root = clone(ClockT);
    const now = signal(ctx.clock.now());
    const r = ctx.random.float();
    text(need(root, "[id='clock.now']"), () => String(now.get()));
    text(need(root, "#rand"), () => String(r));
    on("clock.read", "click", () => now.set(ctx.clock.now()));
    return root;
  },
  { Props: s.object({}) },
);

// Stores, transactions, invariants.
export const Item = s.object({ id: s.string(), qty: s.int() });
export const CartSchema = s.object({ items: s.array(Item) });

// store() must run inside a reactive scope (E1203): one module-level root scope, never disposed.
const makeStores = () => {
  const cart = store(CartSchema, { items: [] }, { id: "cart.cart" });
  const addItem = transaction(cart, "cart.addItem", s.object({ item: Item }), (state, { item }) => ({
    ...state,
    items: [...state.items, item],
  }));

  // Stores whose invariant (qty >= 0 everywhere) a transaction may or may not respect.
  const nonNegative = (state: { readonly items: readonly { readonly qty: number }[] }): boolean =>
    state.items.every((i) => i.qty >= 0);

  const badCart = store(CartSchema, { items: [] }, { id: "bad.cart" });
  invariant(badCart, nonNegative);
  const addAny = transaction(badCart, "bad.addAny", s.object({ item: Item }), (state, { item }) => ({
    ...state,
    items: [...state.items, item],
  }));

  const goodCart = store(CartSchema, { items: [] }, { id: "good.cart" });
  invariant(goodCart, nonNegative);
  const addClamped = transaction(goodCart, "good.addClamped", s.object({ item: Item }), (state, { item }) => ({
    ...state,
    items: [...state.items, { ...item, qty: Math.max(0, item.qty) }],
  }));
  return { cart, addItem, badCart, addAny, goodCart, addClamped };
};

let made: ReturnType<typeof makeStores> | undefined;
scope(() => {
  made = makeStores();
});
if (made === undefined) throw new Error("fixture: store scope did not run");
export const { cart, addItem, badCart, addAny, goodCart, addClamped } = made;

// Cart view: #cart.add adds one item; #cart.total shows the count; #settled trails the count by async effect work.
const CartT = template(
  '<div><button id="cart.add" data-k="cart.add">Add</button><p id="cart.total"></p><p id="settled"></p></div>',
);
export const CartView = Object.assign(
  (props: { readonly compact: boolean }, _slots?: Slots, _ctx?: Ctx): Node => {
    cart.uses([addItem]);
    const root = clone(CartT);
    const settled = signal(0);
    text(need(root, "[id='cart.total']"), () => String(cart.get("items").length));
    text(need(root, "#settled"), () => String(settled.get()));
    attr(need(root, "[id='cart.total']"), "data-compact", () => props.compact);
    effect(
      () => {
        const n = cart.get("items").length;
        void Promise.resolve()
          .then(() => Promise.resolve())
          .then(() => Promise.resolve())
          .then(() => settled.set(n));
      },
      { writes: [settled] },
    );
    on("cart.add", "click", () => {
      tx(addItem, { item: { id: "i1", qty: 1 } });
    });
    return root;
  },
  { Props: s.object({ compact: s.boolean() }) },
);

// A component that violates axe: an image without alt text.
export const BadImg = Object.assign(
  (_props: Record<string, never>, _slots?: Slots, _ctx?: Ctx): Node => clone(template('<img id="pic" src="x.png">')),
  { Props: s.object({}) },
);
