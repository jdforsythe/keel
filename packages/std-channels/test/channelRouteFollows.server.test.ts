// A followed capability that does not listen: a follow not listening within 5,000 ms on the sim clock, or one that
// refuses, ends the stream with no event, a drop; a follow that listens late is stopped. The key is the canonical JSON
// of the params. Seed 1337
import { type SimCtx, createCtx, register } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import fc from "fast-check";
import { expect, test } from "vitest";
import { channel } from "../src/channel.ts";
import { channelRoute } from "../src/server/channelRoute.server.ts";
import { canonicalJson } from "../src/server/internal/canonicalJson.ts";

const BASE = "http://localhost";
const room = channel("t.froom", { path: "/api/froom/events", params: s.object({ room: s.string(), n: s.int() }) });
const turn = () => new Promise<void>((r) => setImmediate(r));
async function until(pred: () => boolean): Promise<void> {
  for (let i = 0; i < 2000 && !pred(); i++) await turn();
  if (!pred()) throw new Error("condition not reached");
}

type Mode = "hang" | "refuse" | "listen";
const seen: { keys: string[]; stopped: number; mode: Mode; release: () => void } = {
  keys: [],
  stopped: 0,
  mode: "listen",
  release: () => undefined,
};
const followed = () => ({
  follow: (_c: { readonly name: string }, key: string): Promise<() => void> => {
    seen.keys.push(key);
    const stop = (): void => {
      seen.stopped += 1;
    };
    if (seen.mode === "refuse") return Promise.reject(new Error("no"));
    if (seen.mode === "listen") return Promise.resolve(stop);
    return new Promise((r) => {
      seen.release = () => r(stop);
    });
  },
});
const db = register("t.followed", { real: followed, shell: followed, sim: followed });

async function serve(): Promise<{ ctx: SimCtx; open: () => Promise<{ events: unknown[]; ended: () => boolean }> }> {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const t = contract("t", {
    "t.froom": { method: "GET", path: "/api/froom/events", query: room.params, events: true, output: room.events },
  });
  const route = channelRoute(t, room, { id: "t.froom", follows: [db], member: () => true });
  const routes = manifest(t, { "t.froom": { loader: route.loader } });
  const app = await createApp({
    topology: topology({ web: { modules: ["t"], adapter: "node" } }),
    routes,
    ctx,
    mode: "dev",
  });
  const open = async () => {
    const res = await app.fetch(
      new Request(`${BASE}${room.path}?n=1&room=a`, { headers: { accept: "text/event-stream" } }),
    );
    const events: unknown[] = [];
    const state = { ended: false };
    void (async () => {
      const text = await res.text();
      for (const line of text.split("\n")) if (line.startsWith("data:")) events.push(JSON.parse(line.slice(5)));
      state.ended = true;
    })();
    return { events, ended: () => state.ended };
  };
  return { ctx, open };
}

test("a follow not listening within 5,000 ms ends the stream with no event, and is stopped when it listens late", async () => {
  seen.mode = "hang";
  seen.stopped = 0;
  const { ctx, open } = await serve();
  const opening = open();
  await until(() => seen.keys.length > 0);
  ctx.clock.advance(4_999);
  for (let i = 0; i < 20; i++) await turn();
  ctx.clock.advance(1);
  const st = await opening;
  await until(st.ended);
  expect(st.events).toEqual([]);
  seen.release();
  await until(() => seen.stopped === 1);
});

test("a follow that refuses ends the stream with no event", async () => {
  seen.mode = "refuse";
  const { open } = await serve();
  const st = await open();
  await until(st.ended);
  expect(st.events).toEqual([]);
});

test("the stream follows at the canonical JSON of its params, whatever the order of the search", async () => {
  seen.mode = "listen";
  seen.keys = [];
  const { open } = await serve();
  await open();
  await until(() => seen.keys.length === 1);
  expect(seen.keys).toEqual(['{"n":1,"room":"a"}']);
});

test("canonicalJson gives one text for any key order, at any depth", () => {
  fc.assert(
    fc.property(fc.dictionary(fc.string({ maxLength: 4 }), fc.jsonValue({ maxDepth: 2 }), { maxKeys: 5 }), (o) => {
      const reversed = Object.fromEntries(Object.entries(o).reverse());
      expect(canonicalJson(reversed)).toBe(canonicalJson(o));
      expect(JSON.parse(canonicalJson(o))).toEqual(JSON.parse(JSON.stringify(o)));
    }),
    { seed: 1337, numRuns: 100 },
  );
});
