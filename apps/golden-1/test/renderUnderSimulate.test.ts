// k.sim's `simulate` example renders a page with `renderRoute` on the run's ctx: while the page loader's request waits on
// the sim clock, the harness settle steps that clock, so the page renders under a schedule that delays its first
// request.
import { renderRoute, simulate } from "@keel/testing";
import { afterEach, expect, test } from "vitest";
import { boardOutbox } from "../modules/todos/boardOutbox.ts";
import { routes } from "../modules/todos/routes.ts";
import { view } from "../modules/todos/view.ts";
import { apiApp, resetApi, seedBoard } from "./simApi.ts";
import { browser, shared } from "./twoClients.ts";

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

test("a page renders on a simulate ctx whose first request is delayed 1 ms", async () => {
  await simulate(
    async ({ ctx, run }) => {
      await seedBoard(shared);
      browser(ctx, await apiApp());
      const r = await renderRoute("todos.list", { routes, params: { listId: "l1" }, ctx });
      open = r;
      await run();
      expect(r.find("todos.row.t1").text).toContain("Milk");
    },
    { replay: { seed: 0, schedule: { net: [{ delay: 1, fault: "none" }], storage: [], offline: [], plans: {} } } },
  );
});
