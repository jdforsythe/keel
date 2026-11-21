// Session: 9a20c4b36977, seed 1337
import { createCtx } from "@keel/ctx";
import { record } from "@keel/std-sessions/record";
import { renderRoute } from "@keel/testing";
import { expect, test } from "vitest";
import { routes } from "../routes.ts";

test("session 9a20c4b36977", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  ctx.clock.advance(1);
  const rec = record(ctx);
  const h = await renderRoute("ops.home", { routes, params: {}, search: {}, state: [], ctx });
  expect(rec.errors()).toEqual([]);
  h.dispose();
});
