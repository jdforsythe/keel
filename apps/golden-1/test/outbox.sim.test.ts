import { scope } from "@keel/reactive";
import { drain, send } from "@keel/std-offline";
import { simulate } from "@keel/testing";
import { fixedTime } from "@keel/tooling/test-time";
import { afterEach, describe, expect, it } from "vitest";
import { TodoIdParams } from "../modules/api/TodoIdParams.schema.ts";
import { boardOutbox } from "../modules/todos/boardOutbox.ts";
import { boardOf } from "./at.ts";
import { BOARD_KEY, apiApp, apiCtx, readBoard, resetApi } from "./simApi.ts";

afterEach(() => resetApi());

/** The race proof's board: Home with Milk (t1) and Bread (t2), head 2. */
const fixture = boardOf({
  lists: [{ id: "l1", name: "Home" }],
  todos: [
    { id: "t1", listId: "l1", title: "Milk", priority: "normal", done: false },
    { id: "t2", listId: "l1", title: "Bread", priority: "normal", done: false },
  ],
});
const T1 = TodoIdParams.parse({ todoId: "t1" });
const T2 = TodoIdParams.parse({ todoId: "t2" });

/** How many entries of `name` the api's stored board log holds. */
async function commits(name: string): Promise<number> {
  const raw = await apiCtx().storage.get(BOARD_KEY);
  const snap: unknown = raw === null ? null : JSON.parse(raw);
  const log = typeof snap === "object" && snap !== null && "log" in snap && Array.isArray(snap.log) ? snap.log : [];
  return log.filter((e: unknown) => typeof e === "object" && e !== null && "name" in e && e.name === name).length;
}

/** Settles `p` either way: a send whose own storage write fails rejects, and its entry stays queued. */
const settled = (p: Promise<unknown>): Promise<boolean> =>
  p.then(
    () => true,
    () => false,
  );

describe("boardOutbox under generated schedules", () => {
  it(
    "a write whose entry left the outbox was applied once; the rest wait as queued, conflict or failed",
    async () => {
      if (!T1.ok || !T2.ok) throw new Error("todo ids do not parse");
      const t1 = T1.value;
      const t2 = T2.value;
      await simulate(
        async ({ ctx, run }) => {
          // A fresh api per run: the server keeps the board it served between requests.
          resetApi();
          await apiCtx().storage.set(BOARD_KEY, JSON.stringify({ state: fixture, log: [], initial: fixture, head: 2 }));
          const app = await apiApp();
          ctx.net.route(new URL("/api/*", location.href).href, (req) => app.fetch(req));
          const page = scope(() => undefined, { detached: true });
          page.run(() => void drain(ctx, boardOutbox, { owner: "" }));
          // The user marks Bread done on the board at head 2, then edits Milk on the board after that write (head 3).
          const toggled = settled(
            send(ctx, boardOutbox, "toggleTodo", { params: t2, body: {} }, { base: 2, owner: "" }),
          );
          const edited = settled(
            send(
              ctx,
              boardOutbox,
              "editTodo",
              { params: t1, body: { title: "Oat milk", priority: "high" } },
              { base: 3, owner: "" },
            ),
          );
          await run();
          await Promise.all([toggled, edited]);
          page.dispose();
          const left = boardOutbox.get("entries");
          const endpoints = left.map((e) => e.endpoint);
          for (const e of left) expect(["queued", "conflict", "failed"]).toContain(e.state);
          const board = await readBoard();

          if (!endpoints.includes("toggleTodo")) {
            expect(await commits("api.toggleTodo")).toBe(1);
            expect(board.todos.find((t) => t.id === "t2")?.done).toBe(true);
          }
          if (!endpoints.includes("editTodo")) {
            expect(await commits("api.editTodo")).toBe(1);
            expect(board.todos.find((t) => t.id === "t1")).toMatchObject({ title: "Oat milk", priority: "high" });
          }
        },
        { runs: 100, seed: 11 },
      );
    },
    fixedTime(120_000),
  );
});
