// k.ctx Observers and Capabilities across module copies: a ctx one copy of `@keel/ctx` made is observed, and builds
// capabilities, through another copy evaluated in the same realm (a test harness's fresh module graph).
import { expect, test, vi } from "vitest";
import type { CtxEvent } from "../src/CtxEvent.ts";
import { createCtx } from "../src/createCtx.ts";
import { seedOf } from "../src/seedOf.ts";

test("an observer registered through a second copy hears the ctx's net change and keeps its seed", async () => {
  const ctx = createCtx({ mode: "sim", seed: 7 });
  vi.resetModules();
  const copy = await import("../src/index.ts");
  expect(copy.createCtx).not.toBe(createCtx);
  const heard: CtxEvent[] = [];
  const stop = copy.observe(ctx, (e) => void heard.push(e));
  ctx.net.setOnline(false);
  ctx.net.setOnline(true);
  stop();
  ctx.net.setOnline(false);
  expect(heard).toEqual([
    { kind: "net", online: false },
    { kind: "net", online: true },
  ]);
  expect(copy.seedOf(ctx)).toBe(seedOf(ctx));
  const sample = copy.register("test.realmShared", {
    sim: ({ seed }) => ({ seed }),
    real: () => ({ seed: -1 }),
    shell: () => ({ seed: -1 }),
  });
  expect(sample(ctx).seed).toEqual(expect.any(Number));
});
