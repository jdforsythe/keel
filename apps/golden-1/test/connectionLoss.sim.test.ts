// Connection loss mid-action and mid-live-stream (std.offline Flush, std.channels Client, std.live). The outbox keeps a
// write whose answer never came, the header names the connection's state, and the reconnect sends the write again under
// its key, so the api applies it once (k.sync); a stream cut while another user writes catches up through `reset`.
import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { type LiveStatus, live } from "@keel/std-live";
import { drain, send } from "@keel/std-offline";
import { renderRoute, simulate } from "@keel/testing";
import { fixedTime } from "@keel/tooling/test-time";
import { afterEach, describe, expect, it } from "vitest";
import { TodoIdParams } from "../modules/api/TodoIdParams.schema.ts";
import { boardChannel } from "../modules/api/boardChannel.schema.ts";
import { boardOutbox } from "../modules/todos/boardOutbox.ts";
import { hydrate } from "../modules/todos/hydrate.ts";
import { routes } from "../modules/todos/routes.ts";
import { todosApi } from "../modules/todos/todosApi.ts";
import { view } from "../modules/todos/view.ts";
import { apiApp, readBoard, resetApi, seedBoard } from "./simApi.ts";
import { browser, commits, otherToggleBread, shared } from "./twoClients.ts";

const shown = view.snapshot();
const queued = boardOutbox.snapshot();
const fresh = (): void => {
  resetApi();
  expect(view.restore(shown).ok).toBe(true);
  expect(boardOutbox.restore(queued).ok).toBe(true);
};
/** The page a simulated run left open: a failing run throws before it can close it. */
let open: { dispose(): void } | undefined;
afterEach(() => {
  open?.dispose();
  open = undefined;
  fresh();
});

const TOGGLE = "POST /api/todos/t1/toggle";
const isToggle = (req: Request): boolean =>
  req.method === "POST" && new URL(req.url).pathname === "/api/todos/t1/toggle";
const done = (id: string) => view.get("todos").find((t) => t.id === id)?.done;

/** User A on list Home, live, over the shared board. */
async function onList(hold?: (req: Request) => number) {
  await seedBoard(shared);
  const app = await apiApp();
  const a = browser(createCtx({ mode: "sim", seed: 1 }), app, hold);
  const b = browser(createCtx({ mode: "sim", seed: 2 }), app);
  const r = await renderRoute("todos.list", { routes, params: { listId: "l1" }, ctx: a.ctx });
  open = r;
  await r.settle();
  expect(r.find("todos.live").text).toBe("Live");
  return { a, b, r };
}

describe("the connection drops mid-action", () => {
  it("after the api applied the write: kept as waiting, Offline shown, sent once more on reconnect and applied once", async () => {
    const { a, r } = await onList();
    a.loseNext(isToggle);
    await r.fire("todos.toggle.t1", { type: "change" });
    await r.settle();
    // The api took it; the answer never came.
    expect(await commits("api.toggleTodo")).toBe(1);
    const [entry] = boardOutbox.get("entries");
    expect(entry).toMatchObject({ endpoint: "toggleTodo", state: "queued" });
    const key = entry?.key ?? "";
    expect(r.find(`todos.outbox.state.${key}`).text).toBe("Waiting to send");
    expect(r.find("todos.live").text).toBe("Offline");

    a.ctx.net.setOnline(true);
    await r.settle();
    expect(a.answers.filter((x) => x.call === TOGGLE).map((x) => x.status)).toEqual([200, 200]);
    expect(boardOutbox.get("entries")).toEqual([]);
    expect(await commits("api.toggleTodo")).toBe(1);
    expect((await readBoard()).todos.find((t) => t.id === "t1")?.done).toBe(true);
    expect(done("t1")).toBe(true);
    expect(r.find("todos.toggle.t1").state.checked).toBe(true);
    expect(r.find("todos.live").text).toBe("Live");
  });

  it("before the api saw it: kept as waiting, Offline shown, applied once on reconnect", async () => {
    let down = false;
    const { a, r } = await onList((req) => (down && isToggle(req) ? 1 : 0));
    // The connection drops while the write is on its way: the page goes offline before it reaches the api.
    down = true;
    const fired = r.fire("todos.toggle.t1", { type: "change" });
    a.ctx.net.setOnline(false);
    a.cut();
    await fired;
    await r.settle();
    a.ctx.clock.advance(1);
    await r.settle();
    const left = boardOutbox.get("entries");
    const reached = await commits("api.toggleTodo");
    // Whichever the sim net did with the request in flight, the write is applied or kept, never dropped.
    if (reached === 0) {
      expect(left).toMatchObject([{ endpoint: "toggleTodo", state: "queued" }]);
      expect(r.find(`todos.outbox.state.${left[0]?.key ?? ""}`).text).toBe("Waiting to send");
    }
    expect(r.find("todos.live").text).toBe("Offline");
    down = false;
    a.ctx.net.setOnline(true);
    await r.settle();
    expect(boardOutbox.get("entries")).toEqual([]);
    expect(await commits("api.toggleTodo")).toBe(1);
    expect(done("t1")).toBe(true);
    expect(r.find("todos.live").text).toBe("Live");
  });
});

describe("the live stream drops", () => {
  // What the header shows between the cut and the reopen: `liveStatusAfterDrop.fails.test.ts`.
  it("cut while online: the reopened stream's reset shows the write it missed", async () => {
    const { a, b, r } = await onList();
    expect(a.cut()).toBe(1);
    await r.settle();
    expect((await otherToggleBread(b.ctx, "b1", 0)).ok).toBe(true);
    await r.settle();
    expect(done("t2")).toBe(false);
    // subscribe reopens 1 s after a drop.
    a.ctx.clock.advance(1000);
    await r.settle();
    expect(done("t2")).toBe(true);
    expect(r.find("todos.toggle.t2").state.checked).toBe(true);
    expect(r.find("todos.live").text).toBe("Live");
  });

  it("offline: Offline, no request while down, and the write missed shows after reconnect", async () => {
    const { a, b, r } = await onList();
    a.ctx.net.setOnline(false);
    a.cut();
    await r.settle();
    expect(r.find("todos.live").text).toBe("Offline");
    const before = a.answers.length;
    expect((await otherToggleBread(b.ctx, "b1", 0)).ok).toBe(true);
    a.ctx.clock.advance(5000);
    await r.settle();
    expect(a.answers.length).toBe(before);
    expect(done("t2")).toBe(false);
    a.ctx.net.setOnline(true);
    await r.settle();
    expect(done("t2")).toBe(true);
    expect(r.find("todos.live").text).toBe("Live");
  });
});

describe("under generated schedules", () => {
  // The shell's wiring (`AppShell`) in a scope, as in `offlineConflictLive.sim.test.ts`; the run after it renders the page.
  it(
    "a toggle sent through drops, lost answers and windows is applied at most once, and A ends showing the board",
    async () => {
      const T1 = TodoIdParams.parse({ todoId: "t1" });
      if (!T1.ok) throw new Error(T1.error.message);
      const t1 = T1.value;
      await simulate(
        async ({ ctx, run }) => {
          open?.dispose();
          open = undefined;
          fresh();
          await seedBoard(shared);
          const app = await apiApp();
          const a = browser(ctx, app);
          let status = (): LiveStatus => "connecting";
          const page = scope(
            () => {
              status = live(ctx, location.origin, boardChannel, {}, { read: (c) => todosApi.lists({}, c), hydrate });
              void drain(ctx, boardOutbox, { owner: "" });
            },
            { detached: true },
          );
          open = page;
          const sent = send(ctx, boardOutbox, "toggleTodo", { params: t1, body: {} }, { base: 0, owner: "" }).catch(
            () => null,
          );
          await run();
          // `run()` stops at the horizon: a window or a retry may reach past it, so the clock runs on until neither is left.
          for (let i = 0; i < 20 && (ctx.clock.next() !== null || !ctx.net.online()); i++) {
            ctx.clock.advance(60_000);
            await run();
          }
          await sent;
          const applied = await commits("api.toggleTodo");
          const left = boardOutbox.get("entries");
          // A flip applied twice would read as not done: the key keeps it to one.
          expect(applied).toBeLessThanOrEqual(1);
          if (left.length === 0) expect(applied).toBe(1);
          else expect(left.map((e) => e.state)).toEqual(["failed"]);
          const board = await readBoard();
          expect(board.todos.find((t) => t.id === "t1")?.done).toBe(applied === 1);
          expect(view.get("todos")).toEqual(board.todos);
          expect(status()).toBe("live");
          page.dispose();
          open = undefined;
        },
        { runs: 100, seed: 31 },
      );
    },
    fixedTime(300_000),
  );

  it(
    "the rendered list page, through the same schedules, ends Live and showing the board",
    async () => {
      const T1 = TodoIdParams.parse({ todoId: "t1" });
      if (!T1.ok) throw new Error(T1.error.message);
      const t1 = T1.value;
      await simulate(
        async ({ ctx, run }) => {
          open?.dispose();
          open = undefined;
          fresh();
          await seedBoard(shared);
          browser(ctx, await apiApp());
          const r = await renderRoute("todos.list", { routes, params: { listId: "l1" }, ctx });
          open = r;
          const sent = send(ctx, boardOutbox, "toggleTodo", { params: t1, body: {} }, { base: 0, owner: "" }).catch(
            () => null,
          );
          await run();
          // `run()` stops at the horizon: a window or a retry may reach past it, so the clock runs on until neither is left.
          for (let i = 0; i < 20 && (ctx.clock.next() !== null || !ctx.net.online()); i++) {
            ctx.clock.advance(60_000);
            await run();
          }
          await sent;
          await r.settle();
          const applied = await commits("api.toggleTodo");
          expect(applied).toBeLessThanOrEqual(1);
          const board = await readBoard();
          expect(view.get("todos")).toEqual(board.todos);
          // A first load that faults or outlasts the 10 s service timeout shows the list's error element naming the api
          // error, and one made offline reads the empty view the page holds, so the list is not found; any other shows
          // the list.
          const ids = r.a11y().flatMap(function walk(n): string[] {
            return [n.id, ...n.children.flatMap(walk)];
          });
          if (ids.includes("todos.error"))
            expect(r.find("todos.error").text).toMatch(/^(api\.(timeout|network|status)|keel\.notFound)/);
          else expect(r.find("todos.toggle.t1").state.checked).toBe(applied === 1);
          expect(r.find("todos.live").text).toBe("Live");
          r.dispose();
          open = undefined;
        },
        { runs: 30, seed: 37 },
      );
    },
    fixedTime(300_000),
  );
});
