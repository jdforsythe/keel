// A stream's re-check after a save: a failed read of the saved stores ends it `closed` `denied` (a failure is a
// denial), and a message published while its re-check is pending reaches it only once the re-check allows it. Seed 1337
import { type Ctx, createCtx } from "@keel/ctx";
import { report } from "@keel/ctx/internal";
import { scope } from "@keel/reactive";
import { manifest } from "@keel/router";
import { s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { store } from "@keel/store";
import { expect, test } from "vitest";
import { channel } from "../src/channel.ts";
import { channelRoute } from "../src/server/channelRoute.ts";

const BASE = "http://localhost";
const Flag = s.object({ on: s.boolean() });
const flags = () => ({ flag: store(Flag, { on: true }, { id: "t.flag" }) });
const room = channel("t.room", {
  path: "/api/room/events",
  params: s.object({ room: s.string() }),
  message: s.object({ text: s.string() }),
});
const turn = () => new Promise<void>((r) => setImmediate(r));
async function until(pred: () => boolean): Promise<void> {
  for (let i = 0; i < 2000 && !pred(); i++) await turn();
  if (!pred()) throw new Error("condition not reached");
}
const copy = scope(() => undefined).run(() => store(Flag, { on: true }, { id: "t.copy" }));
const snap = (on: boolean): string => JSON.stringify({ ...copy.snapshot({ meta: true }), state: { on } });

/** A served channel (room `x` is never a member) whose `ctx.storage.get` can be armed: its next read of `keel.store.t.flag` is `next()`. */
async function serve() {
  const base = createCtx({ mode: "sim", seed: 1337 });
  const armed: { next: (() => Promise<string | null>) | undefined; called: boolean } = {
    next: undefined,
    called: false,
  };
  const ctx: Ctx = {
    ...base,
    storage: {
      get: (k) => {
        const next = armed.next;
        if (next === undefined || k !== "keel.store.t.flag") return base.storage.get(k);
        armed.next = undefined;
        armed.called = true;
        return next();
      },
      set: (k, v) => base.storage.set(k, v),
    },
  };
  const route = channelRoute(room, {
    id: "t.room",
    stores: flags,
    member: ({ params, stores }) => params.room !== "x" && stores.flag.get("on"),
  });
  const routes = manifest({ "t.room": { api: true, path: route.path, loader: route.loader } });
  routes.actions({ "t.room": route.actions });
  const app = await createApp({
    topology: topology({ web: { modules: ["t"], adapter: "node" } }),
    routes,
    ctx,
    mode: "dev",
  });
  const open = async (search: string) => {
    const res = await app.fetch(
      new Request(`${BASE}${route.path}${search}`, { headers: { accept: "text/event-stream" } }),
    );
    const lines: unknown[] = [];
    const state = { ended: false };
    void (async () => {
      const reader = res.body?.getReader();
      const dec = new TextDecoder();
      for (let r = await reader?.read(); r !== undefined && !r.done; r = await reader?.read())
        for (const l of dec.decode(r.value).split("\n")) if (l.startsWith("data:")) lines.push(JSON.parse(l.slice(5)));
      state.ended = true;
    })();
    return { lines, ended: () => state.ended };
  };
  const post = (search: string, body: unknown) =>
    app.fetch(
      new Request(`${BASE}${route.path}${search}`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { accept: "application/json", "content-type": "application/json", "x-keel": "1", origin: BASE },
      }),
    );
  return { ctx, armed, open, post };
}

test("a re-check whose read of the saved stores rejects ends the stream closed denied, and later saves still reach new streams", async () => {
  const h = await serve();
  const rejections: unknown[] = [];
  const onRejection = (e: unknown): void => void rejections.push(e);
  process.on("unhandledRejection", onRejection);
  const st = await h.open("?room=a");
  await until(() => st.lines.length === 1);
  h.armed.next = () => Promise.reject(new Error("storage down"));
  report(h.ctx, { kind: "save", store: "t.flag", head: 1 });
  await until(() => st.ended() || rejections.length > 0);
  expect(st.lines).toEqual([
    { ok: true, value: { kind: "reset" } },
    { ok: true, value: { kind: "closed", reason: "denied" } },
  ]);
  const later = await h.open("?room=a");
  await until(() => later.lines.length === 1);
  report(h.ctx, { kind: "save", store: "t.flag", head: 2 });
  await until(() => later.lines.length === 2);
  expect(later.lines[1]).toEqual({ ok: true, value: { kind: "saved", store: "t.flag", head: 2 } });
  process.off("unhandledRejection", onRejection);
  expect(rejections).toEqual([]);
});

test("a message published while a stream's re-check is pending is not delivered to a stream that re-check revokes", async () => {
  const h = await serve();
  const st = await h.open("?room=a");
  await until(() => st.lines.length === 1);
  let release = (): void => undefined;
  h.armed.next = () =>
    new Promise<string | null>((go) => {
      release = () => go(snap(false));
    });
  report(h.ctx, { kind: "save", store: "t.flag", head: 1 });
  await until(() => h.armed.called);
  expect((await h.post("?room=a", { message: { text: "late" } })).status).toBe(200);
  await turn();
  release();
  await until(() => st.ended());
  expect(st.lines).toEqual([
    { ok: true, value: { kind: "reset" } },
    { ok: true, value: { kind: "closed", reason: "denied" } },
  ]);
});

test("a non-member opening past its caller's cap is denied, not told the cap is reached", async () => {
  const h = await serve();
  const kept: Awaited<ReturnType<typeof h.open>>[] = [];
  for (let i = 0; i < 8; i++) kept.push(await h.open(`?room=r${i}`));
  await until(() => kept.every((st) => st.lines.length === 1));
  const over = await h.open("?room=x");
  await until(() => over.ended());
  expect(over.lines).toEqual([{ ok: true, value: { kind: "closed", reason: "denied" } }]);
});
