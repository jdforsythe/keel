// @vitest-environment node
// `member` gets the request's `user` beside `caller` (k.user): the opener's at open, the publisher's at a publish.
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { s } from "@keel/schema";
import { createApp, identity, topology } from "@keel/server";
import { store } from "@keel/store";
import { expect, test } from "vitest";
import { channel } from "../src/channel.ts";
import { channelRoute } from "../src/server/channelRoute.ts";

const flags = () => ({ flag: store(s.object({ on: s.boolean() }), { on: true }, { id: "u.flag" }) });
const room = channel("u.room", {
  path: "/api/room/events",
  params: s.object({ room: s.string() }),
  message: s.string(),
});

test("member sees the opener's user at open and the publisher's at a publish", async () => {
  const seen: string[] = [];
  const route = channelRoute(room, {
    id: "u.room",
    stores: flags,
    member: ({ user }) => {
      seen.push(user);
      return user !== "";
    },
  });
  const routes = manifest({ "u.room": { api: true, path: route.path, loader: route.loader } });
  routes.actions({ "u.room": route.actions });
  const app = await createApp({
    topology: topology({ web: { modules: ["u"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "dev",
    identity: identity({ identify: async ({ request }) => request.headers.get("x-u") ?? "" }),
  });
  const ac = new AbortController();
  const res = await app.fetch(
    new Request("http://localhost/api/room/events?room=a", {
      headers: { accept: "text/event-stream", "x-u": "opener" },
      signal: ac.signal,
    }),
  );
  const reader = res.body?.getReader();
  await reader?.read();
  const posted = await app.fetch(
    new Request("http://localhost/api/room/events?room=a", {
      method: "POST",
      body: JSON.stringify({ message: "hi" }),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        origin: "http://localhost",
        "x-u": "pub",
      },
    }),
  );
  expect(posted.status).toBe(200);
  const denied = await app.fetch(
    new Request("http://localhost/api/room/events?room=a", {
      method: "POST",
      body: JSON.stringify({ message: "hi" }),
      headers: { accept: "application/json", "content-type": "application/json", origin: "http://localhost" },
    }),
  );
  expect(denied.status).toBe(403);
  ac.abort();
  await app.close();
  expect(seen).toEqual(["opener", "pub", ""]);
});
