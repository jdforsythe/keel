import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { type LiveStatus, live } from "@keel/std-live";
import { drain, send } from "@keel/std-offline";
// An offline edit that conflicts while a live push for the same row arrives (std.offline Flush, std.live, std.channels
// Serve, k.sync 409 `keel.conflict`). User A edits Milk offline; user B edits Milk online first; A reconnects. The push
// (A's re-read after the reset or the saved event) lands before the outbox's answer in one case, after it in the other,
// and in any order under generated schedules. Each time: exactly one edit is stored, A's lost edit stays in the outbox as
// a conflict reached through 409 `keel.conflict`, and A's page ends showing the stored board.
import { type A11yNode, renderRoute, simulate } from "@keel/testing";
import { fixedTime } from "@keel/tooling/test-time";
import { afterEach, describe, expect, it } from "vitest";
import { boardChannel } from "../modules/api/boardChannel.schema.ts";
import { boardOutbox } from "../modules/todos/boardOutbox.ts";
import { hydrate } from "../modules/todos/hydrate.ts";
import { routes } from "../modules/todos/routes.ts";
import { todosApi } from "../modules/todos/todosApi.ts";
import { view } from "../modules/todos/view.ts";
import { apiApp, readBoard, resetApi, seedBoard } from "./simApi.ts";
import { browser, commits, milk, otherEdit, shared, storedHead } from "./twoClients.ts";

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

const EDIT = "POST /api/todos/t1";

function controlId(nodes: readonly A11yNode[], name: string): string {
  for (const n of nodes) {
    if (n.name === name && n.role !== "button") return n.id;
    const inner = controlId(n.children, name);
    if (inner !== "") return inner;
  }
  return "";
}

/** A on Milk's edit page goes offline and saves priority high: the outbox holds it with the head A read. */
async function offlineEdit(ctx: Parameters<typeof renderRoute>[1]["ctx"] & { net: { setOnline(b: boolean): void } }) {
  const r = await renderRoute("todos.edit", { routes, params: { listId: "l1", todoId: "t1" }, ctx });
  await r.settle();
  ctx.net.setOnline(false);
  await r.fire(controlId(r.a11y(), "Priority"), { type: "input", value: "high" });
  await r.fire("todos.save", { type: "click" });
  await r.settle();
  return r;
}

const milkShown = () => view.get("todos").find((t) => t.id === "t1");

describe("an offline edit and the other user's edit of the same todo", () => {
  it("push before the outbox answers: A sees B's title, then its edit as a conflict; B's edit is stored", async () => {
    await seedBoard(shared);
    const app = await apiApp();
    // A's edit waits 100 ms on A's clock before it reaches the api; reads go at once.
    const a = browser(createCtx({ mode: "sim", seed: 1 }), app, (req) => (req.method === "POST" ? 100 : 0));
    const b = browser(createCtx({ mode: "sim", seed: 2 }), app);
    const r = await offlineEdit(a.ctx);
    const [entry] = boardOutbox.get("entries");
    expect(entry).toMatchObject({ endpoint: "editTodo", state: "queued", base: 0 });
    expect((await otherEdit(b.ctx, "Oat milk", "b1", 0)).ok).toBe(true);

    a.ctx.net.setOnline(true);
    await r.settle();
    // The push: A re-read the board and shows B's edit while its own is still on its way.
    expect(milkShown()).toMatchObject({ title: "Oat milk", priority: "normal" });
    expect(a.answers.filter((x) => x.call === EDIT)).toEqual([]);
    expect(r.find("todos.live").text).toBe("Live");

    a.ctx.clock.advance(100);
    await r.settle();
    const key = entry?.key ?? "";
    expect(a.answers.filter((x) => x.call === EDIT)).toEqual([{ call: EDIT, status: 409, code: "keel.conflict" }]);
    expect(boardOutbox.get("entries")).toMatchObject([{ key, state: "conflict", base: 0, head: 1 }]);
    expect(r.find(`todos.outbox.state.${key}`).text).toBe("Someone changed this board first");
    expect(r.find(`todos.outbox.mine.${key}`).name).toBe("Keep mine");
    expect((await readBoard()).todos[0]).toMatchObject({ title: "Oat milk", priority: "normal" });
    expect(await commits("api.editTodo")).toBe(1);
    expect(milkShown()).toMatchObject({ title: "Oat milk", priority: "normal" });
    r.dispose();
  });

  it("push after the outbox answers: A sees its edit as a conflict first, then B's title; B's edit is stored", async () => {
    await seedBoard(shared);
    const app = await apiApp();
    // Once A reconnects, its board reads wait 100 ms on A's clock; its edit goes at once.
    let back = false;
    const a = browser(createCtx({ mode: "sim", seed: 1 }), app, (req) =>
      back && req.method === "GET" && new URL(req.url).pathname === "/api/lists" ? 100 : 0,
    );
    const b = browser(createCtx({ mode: "sim", seed: 2 }), app);
    const r = await offlineEdit(a.ctx);
    const key = boardOutbox.get("entries")[0]?.key ?? "";
    expect((await otherEdit(b.ctx, "Oat milk", "b1", 0)).ok).toBe(true);

    back = true;
    a.ctx.net.setOnline(true);
    await r.settle();
    expect(a.answers.filter((x) => x.call === EDIT)).toEqual([{ call: EDIT, status: 409, code: "keel.conflict" }]);
    expect(boardOutbox.get("entries")).toMatchObject([{ key, state: "conflict", base: 0, head: 1 }]);
    expect(r.find(`todos.outbox.state.${key}`).text).toBe("Someone changed this board first");
    // No push has landed yet: the row still shows the board as A last read it.
    expect(milkShown()).toMatchObject({ title: "Milk", priority: "normal" });

    a.ctx.clock.advance(100);
    await r.settle();
    expect(milkShown()).toMatchObject({ title: "Oat milk", priority: "normal" });
    expect(view.get("head")).toBe(1);
    expect(r.find("todos.live").text).toBe("Live");
    expect(boardOutbox.get("entries")).toMatchObject([{ key, state: "conflict" }]);
    expect((await readBoard()).todos[0]).toMatchObject({ title: "Oat milk", priority: "normal" });
    expect(await commits("api.editTodo")).toBe(1);
    r.dispose();
  });
});

describe("under generated schedules", () => {
  // The shell's wiring (`AppShell`): the board's live view and the outbox drain in one page scope, so each run controls
  // when the edit is queued; `connectionLoss.sim.test.ts` renders the list page under generated schedules.
  it(
    "one edit is stored, the other is a visible 409 keel.conflict, and A ends showing the stored board",
    async () => {
      const outcomes = new Map<string, number>();
      await simulate(
        async ({ ctx, run }) => {
          open?.dispose();
          open = undefined;
          fresh();
          await seedBoard(shared);
          const app = await apiApp();
          const a = browser(ctx, app);
          const b = browser(createCtx({ mode: "sim", seed: 2 }), app);
          const origin = location.origin;
          let status = (): LiveStatus => "connecting";
          const page = scope(
            () => {
              status = live(ctx, origin, boardChannel, {}, { read: (c) => todosApi.lists({}, c), hydrate });
              void drain(ctx, boardOutbox, { owner: "" });
            },
            { detached: true },
          );
          open = page;
          await run();
          // A goes offline and edits Milk over the head its page holds.
          ctx.net.setOnline(false);
          const mine = send(
            ctx,
            boardOutbox,
            "editTodo",
            { params: milk(), body: { title: "Milk", priority: "high" } },
            { base: view.get("head"), owner: "" },
          ).catch(() => null);
          // B edits at a time and A reconnects at a time this run draws, in either order.
          const tB = Math.floor(ctx.random.float() * 4000);
          const tA = Math.floor(ctx.random.float() * 4000);
          const theirs = ctx.clock.after(tB).then(() => otherEdit(b.ctx, "Oat milk", "b1", 0));
          void ctx.clock.after(tA).then(() => ctx.net.setOnline(true));
          await run();
          // `run()` stops at the horizon: a window or a retry may reach past it, so the clock runs on until neither is left.
          for (let i = 0; i < 20 && (ctx.clock.next() !== null || !ctx.net.online()); i++) {
            ctx.clock.advance(60_000);
            await run();
          }
          await mine;
          const other = await theirs;

          const board = await readBoard();
          const stored = board.todos.find((t) => t.id === "t1");
          const left = boardOutbox.get("entries");
          expect(await commits("api.editTodo")).toBe(1);
          const outcome = left.length === 0 ? "A stored" : `B stored, A ${left[0]?.state ?? ""}`;
          outcomes.set(outcome, (outcomes.get(outcome) ?? 0) + 1);
          if (left.length === 0) {
            // A's edit landed first: B's was refused with 409 keel.conflict (to B's service, `api.status` 409).
            expect(stored).toMatchObject({ title: "Milk", priority: "high" });
            expect(other.ok ? "" : other.error.code).toBe("api.status");
            expect(b.answers).toEqual([{ call: EDIT, status: 409, code: "keel.conflict" }]);
          } else {
            // A's edit is kept in the outbox; reached as a conflict, it came from a 409 keel.conflict.
            expect(other.ok).toBe(true);
            expect(stored).toMatchObject({ title: "Oat milk", priority: "normal" });
            expect(left).toHaveLength(1);
            const [e] = left;
            expect(["conflict", "failed"]).toContain(e?.state);
            if (e?.state === "conflict") {
              expect(e.head).toBe(await storedHead());
              expect(a.answers).toContainEqual({ call: EDIT, status: 409, code: "keel.conflict" });
            }
          }
          // What A sees is what is stored, and A's page follows the board again.
          expect(view.get("todos")).toEqual(board.todos);
          expect(view.get("head")).toBe(await storedHead());
          expect(status()).toBe("live");
          page.dispose();
          open = undefined;
        },
        { runs: 100, seed: 23 },
      );
      // The runs reached both orders: A's edit first, and B's first with A's refused as a conflict.
      expect(outcomes.get("A stored")).toBeGreaterThan(0);
      expect(outcomes.get("B stored, A conflict")).toBeGreaterThan(0);
    },
    fixedTime(300_000),
  );
});
