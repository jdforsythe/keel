// Shared fixtures for std.sessions conformance. Property seed: 1337.
// The route component is built from @keel/ui elements, so its inputs go through runtime-dom's delegated listener,
// which reports each `fire` to `observe` (k.ctx). The cart store is seeded empty on every render: one store serves
// every run of a file.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
import { Cart as BugCart } from "./fixtures/cart-bug/modules/cart/Cart.schema.ts";
import { CartSearch as BugSearch } from "./fixtures/cart-bug/modules/cart/CartSearch.schema.ts";

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

// ---- 0094: the buggy fixture (rfc:0070 Conformance diff). `fixtures/cart-bug/` is a project on disk (topology `web`,
// client; happy-dom); `buggyRoutes()` is its route table imported in this process, so the library and `keel session`
// run the same component. Its `cart.checkout` handler throws `keel.unexpected` at `cart.checkout` exactly when the cart
// has items and the card is empty; `fixtures/cart-bug.fix/` overlays the fix.

/**
 * `fixtures/cart-bug/modules/cart/` built in this process, inside a scope (the project's files rely on the compiler's
 * module scope, which this package's vitest does not run): the same store id, transactions, schemas and element ids.
 */
function buildBuggy() {
  const cart = store(BugCart, BUGGY_EMPTY, { id: "cart.cart" });
  const add = transaction(cart, "cart.add", s.object({ sku: s.string() }), (st, p) => ({
    ...st,
    items: [...st.items, p.sku],
  }));
  const setCard = transaction(cart, "cart.setCard", s.object({ number: s.string() }), (st, p) => ({
    ...st,
    card: p.number,
  }));
  const setNote = transaction(cart, "cart.setNote", s.object({ note: s.string() }), (st, p) => ({
    ...st,
    note: p.note,
  }));
  const setPin = transaction(cart, "cart.setPin", s.object({ set: s.boolean() }), (st, p) => ({
    ...st,
    pinSet: p.set,
  }));
  const checkout = (): void => {
    const card = cart.get("card");
    if (cart.get("items").length > 0)
      void tx(setNote, { note: `paid ${"*".repeat(card.length - 1)}${card.slice(-1)}` });
  };
  const CartPage = (): Node =>
    Box({
      as: "main",
      id: "cart.page",
      children: () => [
        Button({ id: "cart.add", children: "Add", onClick: () => void tx(add, { sku: "a" }) }),
        Input({ id: "cart.card", label: "Card", onInput: (v) => void tx(setCard, { number: v }) }),
        Input({ id: "cart.note", label: "Note", onInput: (v) => void tx(setNote, { note: v }) }),
        Input({ id: "cart.pin", label: "Pin", type: "password", onInput: (v) => void tx(setPin, { set: v !== "" }) }),
        Button({ id: "cart.checkout", children: "Checkout", onClick: checkout }),
      ],
    });
  const routes = manifest({ "cart.show": { path: "/cart", search: BugSearch, component: CartPage } });
  return { cart, routes };
}

let buggy: ReturnType<typeof buildBuggy> | undefined;
const buggyFixture = (): ReturnType<typeof buildBuggy> => {
  if (buggy !== undefined) return buggy;
  const made: ReturnType<typeof buildBuggy>[] = [];
  scope(() => {
    made.push(buildBuggy());
  });
  const [first] = made;
  if (first === undefined) throw new Error("buggy fixture: build failed");
  buggy = first;
  return first;
};

/** The buggy fixture's route table, as `fixtures/cart-bug/modules/cart/routes.ts` declares it. */
export const buggyRoutes = () => buggyFixture().routes;

/** The buggy fixture's cart store `cart.cart`. */
export const buggyCart = () => buggyFixture().cart;

/** The buggy fixture's empty cart, as `renderRoute` state. */
export const BUGGY_EMPTY: BugCart = { items: [], card: "", note: "", pinSet: false };

/**
 * The script `add, card "x", card "", nav, add, checkout` recorded on `buggyRoutes()` under seed 1337: 6 inputs, a
 * `keel.unexpected` at `cart.checkout`, and 1-minimal input sets of 2 (`add, checkout`).
 */
export async function buggySession(seed = SEED): Promise<Session> {
  const ctx = simCtx(seed);
  const rec = record(ctx);
  const routes = buggyRoutes();
  const h = await renderRoute("cart.show", { routes, ctx, state: [[buggyCart(), BUGGY_EMPTY]] });
  await h.fire("cart.add", { type: "click" });
  await h.fire("cart.card", { type: "input", value: "x" });
  await h.fire("cart.card", { type: "input", value: "" });
  await h.navigate(routes.href("cart.show"));
  await h.fire("cart.add", { type: "click" });
  await h.fire("cart.checkout", { type: "click" }).catch(() => undefined);
  const session = rec.stop();
  h.dispose();
  return session;
}

/** Every file of `dir` (relative paths, sorted), skipping `node_modules`. */
export function filesOf(dir: string): { path: string; source: string }[] {
  const out: { path: string; source: string }[] = [];
  const walk = (rel: string): void => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      if (e.name === "node_modules") continue;
      const p = rel === "" ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else out.push({ path: p, source: fs.readFileSync(path.join(dir, p), "utf8") });
    }
  };
  walk("");
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE = path.resolve(HERE, "..");
let copies = 0;

/** Whether process `pid` exists (`kill(pid, 0)`: ESRCH is dead, EPERM is alive). */
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return !(e instanceof Error && "code" in e && e.code === "ESRCH");
  }
}

/** Removes every `.tmp-<pid>-*` copy beside the fixtures whose process no longer exists (runs that were killed). */
function removeDeadCopies(): void {
  for (const e of fs.readdirSync(HERE)) {
    const m = /^\.tmp-(\d+)-/.exec(e);
    const pid = m?.[1] === undefined ? undefined : Number(m[1]);
    if (pid !== undefined && (pid === process.pid || !alive(pid))) {
      fs.rmSync(path.join(HERE, e), { recursive: true, force: true });
    }
  }
}

/**
 * A disk copy of `fixtures/cart-bug/` under `conformance/.tmp-<pid>-<n>/` (gitignored; inside the workspace so its
 * imports resolve through the package's `node_modules`, plus a `node_modules/@keel/std-sessions` link to this package).
 * `files()` reads it back for `run`; `fix()` overlays `fixtures/cart-bug.fix/`; `write` adds a file; `dispose()`
 * removes it. Copies of this process id and of dead process ids are removed first.
 */
export function diskFixture(): {
  readonly dir: string;
  files(): { path: string; source: string }[];
  write(rel: string, source: string): void;
  fix(): void;
  dispose(): void;
} {
  removeDeadCopies();
  const dir = path.join(HERE, `.tmp-${process.pid}-${copies++}`);
  fs.cpSync(path.join(HERE, "fixtures", "cart-bug"), dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "node_modules", "@keel"), { recursive: true });
  fs.symlinkSync(PACKAGE, path.join(dir, "node_modules", "@keel", "std-sessions"), "dir");
  const write = (rel: string, source: string): void => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), source);
  };
  return {
    dir,
    files: () => filesOf(dir),
    write,
    fix: () => fs.cpSync(path.join(HERE, "fixtures", "cart-bug.fix"), dir, { recursive: true }),
    dispose: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

/** Apply `run` writes to the disk copy `dir` (what the binary's host does). */
export const applyTo =
  (dir: string) =>
  (writes: readonly { readonly path: string; readonly content: string | null }[]): void => {
    for (const w of writes) {
      const p = path.join(dir, w.path);
      if (w.content === null) fs.rmSync(p, { force: true });
      else {
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, w.content);
      }
    }
  };

/** Marker strings `markedSession()` records; only `exposed` (the store's `note`) is named by an `expose` entry. */
export const MARKERS = {
  exposed: "MARKNOTE01",
  hidden: {
    item: "MARKITEM02",
    search: "MARKSEARCH03",
    card: "MARKCARD04",
    password: "MARKPASS05",
    coupon: "MARKCOUPON06",
  },
} as const;

/**
 * A failing session on `buggyRoutes()` whose base state, route search, `fire` input values, password input and
 * `s.secret` search value hold the `MARKERS`: base state `{ items: [item], note: exposed }`, search `{ q: search,
 * coupon: secret(coupon) }`, then `card` typed and cleared, `pin` (a password input) typed, and checkout (it throws).
 */
export async function markedSession(seed = SEED): Promise<Session> {
  const ctx = simCtx(seed);
  const rec = record(ctx);
  const routes = buggyRoutes();
  const coupon = BugSearch.parse({ q: MARKERS.hidden.search, coupon: MARKERS.hidden.coupon });
  if (!coupon.ok) throw new Error("markedSession: search does not parse");
  const state = { items: [MARKERS.hidden.item], card: "", note: MARKERS.exposed, pinSet: false };
  const h = await renderRoute("cart.show", { routes, ctx, search: coupon.value, state: [[buggyCart(), state]] });
  await h.fire("cart.card", { type: "input", value: MARKERS.hidden.card });
  await h.fire("cart.card", { type: "input", value: "" });
  await h.fire("cart.pin", { type: "input", value: MARKERS.hidden.password });
  await h.fire("cart.checkout", { type: "click" }).catch(() => undefined);
  const session = rec.stop();
  h.dispose();
  return session;
}

/** `modules/cart/module.ts` of the buggy fixture with `expose` entries for sessions. */
export const exposingModule = (expose: readonly string[]): string => `import { module } from "@keel/compiler";

export default module({
  id: "cart",
  deps: ["@keel/std-sessions"],
  capabilities: [],
  public: { exports: [], routes: ["cart.show"] },
  std: { "@keel/std-sessions": { expose: ${JSON.stringify(expose)} } },
});
`;

/** A session file's text as `keel session` writes it. */
export const sessionFile = (v: Session): string => `${JSON.stringify(SessionSchema.encode(v), null, 2)}\n`;
