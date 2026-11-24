// @vitest-environment node
// What judging a stream's user again costs (std.channels Serve, k.user): with no identity source the stream is handed a
// `fixed` `currentUser` and its deliveries run no judge, read no clock and set no timer; with one, a burst costs one
// `identify` per stream per second of `ctx.clock`.
import { createCtx } from "@keel/ctx";
import type { SimCtx } from "@keel/ctx";
import { type CurrentUser, action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { createApp, identity, topology } from "@keel/server";
import { store, transaction, tx } from "@keel/store";
import { expect, test } from "vitest";
import { channel } from "../src/channel.ts";
import { channelRoute } from "../src/server/channelRoute.ts";

const Room = s.object({ room: s.string() });
const room = channel("cost.room", { path: "/api/room/events", params: Room });
const factory = () => {
  const log = store(s.object({ n: s.int() }), { n: 0 }, { id: "cost.log" });
  return { log, bump: transaction(log, "cost.bump", s.object({}), (st) => ({ n: st.n + 1 })) };
};
const c = contract("cost", {
  "cost.room": { method: "GET", path: "/api/room/events", query: Room, events: true, output: room.events },
  "cost.bump": { method: "POST", path: "/api/bump", body: s.object({}), output: s.object({}) },
});

/** The 5,000 ms wait the stream's open makes for its storage `watch` (k.persist Watch): the sim storage has one. It is no identify's. */
const WATCH_BOUND = 1;

const turns = async (n = 25): Promise<void> => {
  for (let i = 0; i < n; i++) await new Promise<void>((r) => setTimeout(r, 0));
};

async function rig(identify: (() => string) | undefined, open = true) {
  const ctx: SimCtx = createCtx({ mode: "sim", seed: 1337 });
  const bounds = { n: 0 };
  const clock = { now: 0, after: 0 };
  const after = ctx.clock.after.bind(ctx.clock);
  const now = ctx.clock.now.bind(ctx.clock);
  // Counts every clock read and wait; a 5,000 ms wait is the bound an `identify` call runs under.
  Reflect.set(ctx.clock, "after", (ms: number, signal?: AbortSignal) => {
    clock.after++;
    if (ms === 5_000) bounds.n++;
    return after(ms, signal);
  });
  Reflect.set(ctx.clock, "now", () => {
    clock.now++;
    return now();
  });
  const given: { currentUser?: CurrentUser | undefined } = {};
  const calls = { stream: 0, other: 0 };
  const route = channelRoute(c, room, { id: "cost.room", stores: factory, member: () => true });
  // The stream's loader as served, noting the `currentUser` the server hands it.
  const watched = {
    ...route.loader,
    live: (a: Parameters<typeof route.loader.live>[0], cx: Parameters<typeof route.loader.live>[1]) => {
      given.currentUser = a.currentUser;
      return route.loader.live(a, cx);
    },
  };
  const bump = action(c, "cost.bump", { stores: factory }, async (_b, { stores }) => {
    tx(stores.bump, {});
    return ok({});
  });
  const source =
    identify === undefined
      ? {}
      : {
          identity: identity({
            identify: async ({ request }) => {
              const stream = (request.headers.get("accept") ?? "").includes("text/event-stream");
              if (stream) calls.stream++;
              else calls.other++;
              return identify();
            },
          }),
        };
  const app = await createApp({
    topology: topology({ web: { modules: ["cost"], adapter: "node" } }),
    routes: manifest(c, { "cost.room": { loader: watched }, "cost.bump": { action: bump } }),
    ctx,
    mode: "dev",
    ...source,
  });
  const ac = new AbortController();
  const res = open
    ? await app.fetch(
        new Request("http://localhost/api/room/events?room=a", {
          headers: { accept: "text/event-stream" },
          signal: ac.signal,
        }),
      )
    : undefined;
  const reader = res?.body?.getReader();
  const events: unknown[] = [];
  const dec = new TextDecoder();
  void (async () => {
    for (;;) {
      const r = await reader?.read();
      if (r === undefined || r.done) return;
      for (const line of dec.decode(r.value).split("\n"))
        if (line.startsWith("data:")) events.push(Reflect.get(JSON.parse(line.slice(5)), "value"));
    }
  })();
  await turns();
  const save = async (): Promise<void> => {
    const r = await app.fetch(
      new Request("http://localhost/api/bump", {
        method: "POST",
        body: "{}",
        headers: { accept: "application/json", "content-type": "application/json", origin: "http://localhost" },
      }),
    );
    expect(r.status).toBe(200);
  };
  return {
    ctx,
    bounds,
    clock,
    given,
    calls,
    events,
    save,
    close: async () => {
      ac.abort();
      await app.close();
    },
  };
}

const kinds = (events: unknown[]): unknown[] => events.map((e) => Reflect.get(Object(e), "kind"));

test("with no identity source, a stream's 40 deliveries over 4 s run no judge, read no clock and set no timer", async () => {
  const r = await rig(undefined);
  // The stream was handed a fixed `currentUser`, so its route chose, at open, the path with no judge on it.
  expect(r.given.currentUser?.fixed).toBe(true);
  const heartbeat = r.ctx.clock.next();
  r.clock.now = 0;
  r.clock.after = 0;
  for (let i = 0; i < 40; i++) {
    await r.save();
    r.ctx.clock.advance(100);
  }
  await turns();
  expect(kinds(r.events)).toEqual(["reset", ...Array.from({ length: 40 }, () => "saved")]);
  expect(r.bounds.n).toBe(WATCH_BOUND);
  expect(r.clock.after).toBe(0);
  expect(r.ctx.clock.next()).toBe(heartbeat);
  // The same saves with no stream open read the clock as often: the stream's deliveries read it not at all.
  const bare = await rig(undefined, false);
  bare.clock.now = 0;
  for (let i = 0; i < 40; i++) {
    await bare.save();
    bare.ctx.clock.advance(100);
  }
  await turns();
  expect(r.clock.now).toBe(bare.clock.now);
  await bare.close();
  await r.close();
});

test("with an identity source, a burst of 40 saves over 4 s costs one `identify` per second for the stream", async () => {
  const r = await rig(() => "u1");
  const atOpen = r.calls.stream;
  for (let i = 0; i < 40; i++) {
    await r.save();
    await turns(5);
    r.ctx.clock.advance(100);
  }
  await turns();
  expect(kinds(r.events)).toEqual(["reset", ...Array.from({ length: 40 }, () => "saved")]);
  expect(r.calls.stream - atOpen).toBe(4);
  // Each save is a request and runs `identify` as one.
  expect(r.calls.other).toBe(40);
  expect(r.bounds.n).toBe(WATCH_BOUND + r.calls.stream + r.calls.other);
  expect(r.given.currentUser?.fixed).toBe(false);
  await r.close();
});
