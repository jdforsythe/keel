// Spec: std.live, clause "Under sim, with callers A and B live on one page, A through a `createApp` on ctx `a` and B through one on `replica(a)` (k.sim Replicas), a write by A to a store the channel's `stores` creates is in B's hydrated store after B's next read, with no input from B."
// Seed: 1337.
// Reading: "live on one page" is two `live` calls in one test, A's on ctx `a` against origin `https://a.example.com` and B's on `replica(a)` against origin `https://b.example.com`; the ctxs share one net, so each origin is routed to its own `createApp`.
// Reading: a `read` is the app's own read of the stores it serves: B's reads the board store through B's ctx storage (a loader reads the same snapshot); `hydrate` commits it. "No input from B" is: B's page does nothing after its `live` call.
// Reading: the write is an action on A's app, POST `/api/board`, saving the `board.items` store the channel's `stores` creates.
// Reading: waits count event-loop turns (no clock, no timer).
import { createCtx, replica } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { channel } from "@keel/std-channels";
import { channelRoute } from "@keel/std-channels/server";
import { live } from "@keel/std-live";
import { store, transaction, tx } from "@keel/store";
import fc from "fast-check";
import { afterEach, expect, test } from "vitest";

const SEED = 1337;
const BASE = "http://localhost";
const ORIGIN_A = "https://a.example.com";
const ORIGIN_B = "https://b.example.com";
const Board = s.object({ head: s.int(), items: s.array(s.string()) });
const Items = s.object({ items: s.array(s.string()) });
const Nothing = s.object({});
const boardChannel = channel("board.events", { path: "/api/board/events", params: Nothing, message: Nothing });

const turn = (): Promise<void> => new Promise<void>((r) => setImmediate(r));
async function waitFor(pred: () => boolean): Promise<void> {
  for (let i = 0; i < 4000; i++) {
    if (pred()) return;
    await turn();
  }
  throw new Error("waitFor: condition not reached");
}
const field = (v: unknown, k: string): unknown => (typeof v === "object" && v !== null ? Reflect.get(v, k) : undefined);

const factory = () => {
  const board = store(Items, { items: [] }, { id: "board.items" });
  const add = transaction(board, "board.add", s.object({ item: s.string() }), (st, { item }) => ({
    items: [...st.items, item],
  }));
  return { board, add };
};

interface Fetcher {
  fetch(req: Request): Promise<Response>;
}

async function serve(ctx: SimCtx): Promise<Fetcher> {
  const api = contract("board", {
    "board.events": {
      method: "GET",
      path: "/api/board/events",
      query: Nothing,
      events: true,
      output: boardChannel.events,
    },
    "board.publish": {
      method: "POST",
      path: "/api/board/events",
      query: Nothing,
      body: boardChannel.body,
      output: Nothing,
    },
    "board.add": { method: "POST", path: "/api/board", body: s.object({ item: s.string() }), output: Nothing },
  });
  const events = channelRoute(api, boardChannel, {
    id: "board.events",
    publish: "board.publish",
    stores: factory,
    member: () => true,
  });
  const add = action(api, "board.add", { stores: factory }, async ({ item }, { stores }) => {
    tx(stores.add, { item });
    return ok({});
  });
  const routes = manifest(api, {
    "board.events": { loader: events.loader },
    "board.publish": { action: events.action },
    "board.add": { action: add },
  });
  return createApp({ topology: topology({ web: { modules: ["board"], adapter: "node" } }), routes, ctx, mode: "dev" });
}

const apps: Fetcher[] = [];
afterEach(async () => {
  for (const app of apps.splice(0)) {
    const close: unknown = Reflect.get(Object(app), "close");
    if (typeof close === "function") await Reflect.apply(close, app, []);
  }
});

/** `live` on `ctx` against `origin`, hydrating a fresh client store `view` from the board store's snapshot in `ctx.storage`. */
function page(ctx: SimCtx, origin: string, id: string) {
  const made: { view?: ReturnType<typeof makeView> } = {};
  const viewScope = scope(() => {
    made.view = makeView(id);
  });
  const view = made.view;
  if (view === undefined) throw new Error("page: store scope did not run");
  let reads = 0;
  const sc = scope(() => {
    live(
      ctx,
      origin,
      boardChannel,
      {},
      {
        read: async (c) => {
          reads++;
          const raw = await c.storage.get("keel.store.board.items");
          const snap: unknown = JSON.parse(raw ?? "null");
          const state = field(snap, "state");
          const head = field(snap, "head");
          const items = field(state, "items");
          return ok({
            head: typeof head === "number" ? head : 0,
            items: Array.isArray(items) ? items.map(String) : [],
          });
        },
        hydrate: view.hydrate,
      },
    );
  });
  return {
    view: view.store,
    hydrate: view.hydrate,
    reads: () => reads,
    dispose: () => {
      sc.dispose();
      viewScope.dispose();
    },
  };
}

function makeView(id: string) {
  const view = store(Board, { head: 0, items: [] }, { id });
  const hydrate = transaction(view, "board.hydrate", Board, (_st, p) => p);
  return { store: view, hydrate };
}

const postAdd = (app: Fetcher, item: string): Promise<Response> =>
  app.fetch(
    new Request(`${BASE}/api/board`, {
      method: "POST",
      body: JSON.stringify({ item }),
      headers: { accept: "application/json", "content-type": "application/json", "x-keel": "1", origin: BASE },
    }),
  );

test("under sim, with callers A and B live on one page, A through a `createApp` on ctx `a` and B through one on `replica(a)` (k.sim Replicas), a write by A to a store the channel's `stores` creates is in B's hydrated store after B's next read, with no input from B", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(fc.string({ maxLength: 8 }), { minLength: 1, maxLength: 5 }), async (items) => {
      const a = createCtx({ mode: "sim", seed: SEED });
      const b = replica(a);
      const A = await serve(a);
      const B = await serve(b);
      apps.push(A, B);
      a.net.route(`${ORIGIN_A}/*`, (req) => A.fetch(req));
      a.net.route(`${ORIGIN_B}/*`, (req) => B.fetch(req));
      const pa = page(a, ORIGIN_A, "view.a");
      const pb = page(b, ORIGIN_B, "view.b");
      try {
        // Each page's first read follows its stream's `reset`.
        await waitFor(() => pa.reads() >= 1 && pb.reads() >= 1);
        const readsB = pb.reads();
        const logB = pb.view.log().length;
        for (const [i, item] of items.entries()) {
          expect((await postAdd(A, item)).status).toBe(200);
          await waitFor(() => pb.view.get("items").length === i + 1);
          expect(pb.view.get("items")).toEqual(items.slice(0, i + 1));
          expect(pb.view.get("head")).toBe(i + 1);
        }
        expect(pb.reads()).toBeGreaterThan(readsB);
        expect(pb.view.log().length).toBeGreaterThan(logB);
        // B's page took no input: its log holds hydrations only.
        expect(pb.view.log().every((e) => e.name === pb.hydrate.name)).toBe(true);
      } finally {
        pa.dispose();
        pb.dispose();
      }
    }),
    { seed: SEED, numRuns: 8 },
  );
});
