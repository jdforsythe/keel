// Shared fixtures for the rfc:0214 std.channels and std.live conformance files (not a test file). Seed 1337.
// Assumption: two replicas are two `createApp`s serving one channel route with `stores`, one on a sim ctx `a` and one on `b = replica(a)` (k.sim Replicas); a caller cookie is minted and used on one app only.
// Assumption: the stores are `chan.members` (who may open), `chan.log` and `chan.notes`; `chan.clear` empties `chan.members` for every caller, so a save on one replica can turn `member` false for a stream open on the other.
// Assumption: writes carry `origin`, `accept: application/json` and `x-keel: 1` (the k.server same-site proof); a response's caller cookie is `keel-caller`.
import { createCtx, replica } from "@keel/ctx";
import type { Ctx, SimCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { type ObjectSchema, ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { channelRoute } from "@keel/std-channels/server";
import { store, transaction, tx } from "@keel/store";
import { BASE, type Fetcher, type Stream, field, openStream, roomChannel } from "./fixtures.ts";
import { Room } from "./fixtures.ts";

export const SEED = 1337;
export const STORES = ["chan.log", "chan.notes"] as const;

const Nothing = s.object({});
const Ids = s.object({ ids: s.array(s.string()) });
const Counter = s.object({ n: s.int() });
const Texts = s.object({ items: s.array(s.string()) });

const factory = () => {
  const members = store(Ids, { ids: [] }, { id: "chan.members" });
  const log = store(Counter, { n: 0 }, { id: "chan.log" });
  const notes = store(Texts, { items: [] }, { id: "chan.notes" });
  const join = transaction(members, "chan.join", s.object({ id: s.string() }), (st, { id }) => ({
    ids: [...st.ids, id],
  }));
  const clear = transaction(members, "chan.clear", Nothing, () => ({ ids: [] }));
  const bump = transaction(log, "chan.bump", Nothing, (st) => ({ n: st.n + 1 }));
  const note = transaction(notes, "chan.note", s.object({ text: s.string() }), (st, { text }) => ({
    items: [...st.items, text],
  }));
  return { members, log, notes, join, clear, bump, note };
};

const entry = <B extends ObjectSchema<object>>(path: string, body: B) =>
  ({ method: "POST", path, body, output: s.object({}) }) as const;

export interface Replica {
  readonly ctx: Ctx;
  readonly app: Fetcher;
  post(path: string, body: unknown, o?: { cookie?: string; search?: string }): Promise<Response>;
  /** A fresh caller that joined `chan.members`, as a cookie. */
  enroll(): Promise<string>;
  act(op: "bump" | "note" | "clear", text?: string): Promise<void>;
  open(room: string, cookie?: string): Promise<Stream>;
  close(): Promise<void>;
}

const cookieOf = (res: Response): string => {
  const header = res.headers.get("set-cookie");
  if (header === null) throw new Error("no caller cookie was set");
  return header.split(";")[0] ?? "";
};

/** One `createApp` serving the channel route with `stores` on `ctx`. */
export async function serveOn(ctx: Ctx): Promise<Replica> {
  const chan = contract("chan", {
    "chan.room": { method: "GET", path: "/api/room/events", query: Room, events: true, output: roomChannel.events },
    "chan.publish": {
      method: "POST",
      path: "/api/room/events",
      query: Room,
      body: roomChannel.body,
      output: s.object({}),
    },
    "chan.join": entry("/api/join", Nothing),
    "chan.clear": entry("/api/clear", Nothing),
    "chan.bump": entry("/api/bump", Nothing),
    "chan.note": entry("/api/note", s.object({ text: s.string() })),
  });
  const room = channelRoute(chan, roomChannel, {
    id: "chan.room",
    publish: "chan.publish",
    stores: factory,
    member: ({ caller, stores }) => stores.members.get("ids").includes(caller),
  });
  const join = action(chan, "chan.join", { stores: factory }, async (_b, { caller, stores }) => {
    tx(stores.join, { id: caller });
    return ok({});
  });
  const clear = action(chan, "chan.clear", { stores: factory }, async (_b, { stores }) => {
    tx(stores.clear, {});
    return ok({});
  });
  const bump = action(chan, "chan.bump", { stores: factory }, async (_b, { stores }) => {
    tx(stores.bump, {});
    return ok({});
  });
  const note = action(chan, "chan.note", { stores: factory }, async ({ text }, { stores }) => {
    tx(stores.note, { text });
    return ok({});
  });
  const routes = manifest(chan, {
    "chan.room": { loader: room.loader },
    "chan.publish": { action: room.action },
    "chan.join": { action: join },
    "chan.clear": { action: clear },
    "chan.bump": { action: bump },
    "chan.note": { action: note },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["chan"], adapter: "node" } }),
    routes,
    ctx,
    mode: "dev",
  });
  const post: Replica["post"] = (path, body, o = {}) =>
    app.fetch(
      new Request(`${BASE}${path}${o.search ?? ""}`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-keel": "1",
          origin: BASE,
          ...(o.cookie === undefined ? {} : { cookie: o.cookie }),
        },
      }),
    );
  return {
    ctx,
    app,
    post,
    enroll: async () => cookieOf(await post("/api/join", {})),
    act: async (op, text = "n") => {
      const res = await post(`/api/${op}`, op === "note" ? { text } : {});
      if (res.status !== 200) throw new Error(`${op} answered ${res.status}`);
    },
    open: (r, cookie) => openStream(app, r, cookie),
    close: async () => {
      const close: unknown = Reflect.get(Object(app), "close");
      if (typeof close === "function") await Reflect.apply(close, app, []);
    },
  };
}

export interface Pair {
  readonly a: SimCtx;
  readonly b: SimCtx;
  readonly A: Replica;
  readonly B: Replica;
  /** The `head` of a store as the shared storage holds it, or 0 when none is stored. */
  headOf(id: string): Promise<number>;
  close(): Promise<void>;
}

/** `createApp` A on a sim ctx `a` and B on `replica(a)`, serving one channel route with `stores`. */
export async function serveReplicas(): Promise<Pair> {
  const a = createCtx({ mode: "sim", seed: SEED });
  const b = replica(a);
  const A = await serveOn(a);
  const B = await serveOn(b);
  return {
    a,
    b,
    A,
    B,
    headOf: async (id) => {
      const raw = await a.storage.get(`keel.store.${id}`);
      const head = field(JSON.parse(raw ?? "null"), "head");
      return typeof head === "number" ? head : 0;
    },
    close: async () => {
      await A.close();
      await B.close();
    },
  };
}

/** The `saved` events of one store on a stream, as their heads in delivery order. */
export const headsOf = (events: readonly unknown[], store: string): number[] =>
  events.flatMap((e) => {
    if (field(e, "kind") !== "saved" || field(e, "store") !== store) return [];
    const head = field(e, "head");
    return typeof head === "number" ? [head] : [];
  });
