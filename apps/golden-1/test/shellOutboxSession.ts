import type { SimCtx } from "@keel/ctx";
import type { JsonValue } from "@keel/schema";
import { createApp } from "@keel/server";
import { type SessionGroup, openGroup, replayGroup } from "@keel/std-sessions/group";
import topology from "../topology.ts";
import { apiRoutes } from "./apiRoutes.ts";
import { SECRET } from "./simApi.ts";

const USER = new URL("./user.ts", import.meta.url).href;
const home = {
  lists: [{ id: "l1", name: "Home" }],
  todos: [
    { id: "t1", listId: "l1", title: "Milk", priority: "normal", done: false },
    { id: "t2", listId: "l1", title: "Bread", priority: "normal", done: false },
  ],
};

/**
 * The shell outbox session (std.multi, std.offline): one user of golden-1's `api` over a sim ctx of seed 11, starting
 * from the stored board `board` (Home with Milk and Bread), opens Home, goes offline, marks Bread done and adds Butter
 * (both wait in `todos.outbox`), then comes back online, where the outbox drains. Each input is followed by `settle`
 * and 1 ms on every clock. Resolves to the recorded group, the server board as the live run left it, and
 * `replayGroup`'s server board and `reproduced` for that group.
 */
export async function shellOutboxSession(): Promise<{
  board: string;
  group: SessionGroup;
  live: JsonValue;
  replayed: JsonValue;
  reproduced: boolean;
}> {
  const board = JSON.stringify({ state: home, log: [], initial: home, head: 2 });
  const servers: SimCtx[] = [];
  const serve = (ctx: SimCtx) => {
    servers.push(ctx);
    const app = createApp({ topology, deployable: "api", routes: apiRoutes, ctx, secret: SECRET });
    return { fetch: async (req: Request) => (await app).fetch(req) };
  };
  const g = await openGroup({
    user: USER,
    serve,
    users: 1,
    seed: 11,
    origin: "http://golden-1.test",
    server: { "api.board": board },
  });
  const step = async (f: () => Promise<void> | void): Promise<void> => {
    await f();
    await g.settle();
    await g.advance(1);
  };
  const u0 = g.user(0);
  await step(() => u0.navigate("/lists/l1"));
  await step(() => g.setOnline(0, false));
  await step(() => u0.fire("todos.toggle.t2", { type: "change" }));
  await step(() => u0.fire("todos.addForm:title", { type: "input", value: "Butter" }));
  await step(() => u0.fire("todos.addTodo", { type: "click" }));
  await step(() => g.setOnline(0, true));
  const stored = await servers.at(-1)?.storage.get("keel.store.api.board");
  const live: JsonValue = stored === undefined || stored === null ? null : JSON.parse(stored);
  const group = await g.stop();
  const replay = await replayGroup(group, { user: USER, serve });
  const replayed: JsonValue = JSON.parse(JSON.stringify(replay.server["api.board"] ?? null));
  return { board, group, live, replayed, reproduced: replay.reproduced };
}
