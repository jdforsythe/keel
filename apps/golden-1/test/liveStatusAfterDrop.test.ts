// After the board stream drops while online, `subscribe` waits 1 s (doubling to 30 s) to reopen. In that gap nothing is
// followed, so std.channels' `status()` is `connecting` and std.live's is `connecting` (the header leaves Live); the
// reopened stream's `reset` makes the page re-read, which brings in what the other user wrote during the gap.
import { createCtx } from "@keel/ctx";
import { scope } from "@keel/reactive";
import { subscribe } from "@keel/std-channels";
import { renderRoute } from "@keel/testing";
import { afterEach, expect, test } from "vitest";
import { boardChannel } from "../modules/api/boardChannel.schema.ts";
import { boardOutbox } from "../modules/todos/boardOutbox.ts";
import { routes } from "../modules/todos/routes.ts";
import { view } from "../modules/todos/view.ts";
import { apiApp, resetApi, seedBoard } from "./simApi.ts";
import { browser, otherToggleBread, shared } from "./twoClients.ts";

const shown = view.snapshot();
const queued = boardOutbox.snapshot();
let open: { dispose(): void } | undefined;
afterEach(() => {
  open?.dispose();
  open = undefined;
  resetApi();
  expect(view.restore(shown).ok).toBe(true);
  expect(boardOutbox.restore(queued).ok).toBe(true);
});

test("the header leaves Live once the board stream drops, and the reopen catches up on the gap", async () => {
  await seedBoard(shared);
  const app = await apiApp();
  const a = browser(createCtx({ mode: "sim", seed: 1 }), app);
  const b = browser(createCtx({ mode: "sim", seed: 2 }), app);
  const r = await renderRoute("todos.list", { routes, params: { listId: "l1" }, ctx: a.ctx });
  open = r;
  await r.settle();
  expect(r.find("todos.live").text).toBe("Live");
  expect(a.cut()).toBe(1);
  expect((await otherToggleBread(b.ctx, "b1", 0)).ok).toBe(true);
  await r.settle();
  // The page missed B's write and has no stream: it is not live.
  expect(r.find("todos.toggle.t2").state.checked).toBe(false);
  expect(r.find("todos.live").text).toBe("Connecting");
  // The reopen 1 s later starts with `reset`; the re-read holds B's write.
  await a.ctx.clock.advance(1000);
  await r.settle();
  expect(r.find("todos.toggle.t2").state.checked).toBe(true);
  expect(r.find("todos.live").text).toBe("Live");
});

test("subscribe's status is connecting, not open, while it waits to reopen after a drop", async () => {
  await seedBoard(shared);
  const app = await apiApp();
  const a = browser(createCtx({ mode: "sim", seed: 1 }), app);
  const r = await renderRoute("todos.list", { routes, params: { listId: "l1" }, ctx: a.ctx });
  open = r;
  const kinds: string[] = [];
  let status = (): string => "";
  const page = scope(
    () => {
      status = subscribe(a.ctx, location.origin, boardChannel, {}, (e) => kinds.push(e.kind)).status;
    },
    { detached: true },
  );
  open = {
    dispose: () => {
      page.dispose();
      r.dispose();
    },
  };
  await r.settle();
  expect([kinds, status()]).toEqual([["reset"], "open"]);
  a.cut();
  await r.settle();
  // The reopen is pending 1 s out on the clock; nothing is open.
  expect(a.ctx.clock.next()).toBe(1000);
  expect(status()).toBe("connecting");
});
