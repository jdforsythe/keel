// Session: fb142676235c, seed 0
import { createCtx } from "@keel/ctx";
import { record } from "@keel/std-sessions/record";
import { renderRoute } from "@keel/testing";
import { expect, test } from "vitest";
import { routes } from "../routes.ts";

test("session fb142676235c", async () => {
  const ctx = createCtx({ mode: "sim", seed: 0 });
  ctx.clock.advance(1794262903390);
  const rec = record(ctx);
  const h = await renderRoute("ops.home", { routes, params: {}, search: {}, state: [], ctx });
  ctx.clock.advance(557);
  await h.fire("ops.home.limits", { type: "click" });
  expect(rec.errors()).toEqual([]);
  h.dispose();
});
