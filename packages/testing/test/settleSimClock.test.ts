// @vitest-environment happy-dom
// k.testing settle: a simulated clock deadline the page does not wait on (a debounce) does not shorten the busy bound,
// so a loader that takes thousands of macrotask turns beside one still settles. Seed: 1337.
import { createCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import { renderRoute } from "@keel/testing";
import { describe, expect, it } from "vitest";

const turn = (): Promise<void> =>
  new Promise((done) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (): void => {
      channel.port1.close();
      done();
    };
    channel.port2.postMessage(0);
  });

const Out = s.object({ turns: s.number() });
const routes = manifest({
  "clk.slow": {
    path: "/slow",
    loader: loader({ output: Out }, async (_args, ctx) => {
      void ctx.clock.after(1000);
      for (let i = 0; i < 3000; i++) await turn();
      return ok({ turns: 3000 });
    }),
    component: () => document.createElement("p"),
  },
});

describe("settle beside a pending sim clock deadline", () => {
  it("waits out a loader of 3,000 macrotask turns while a deadline nothing awaits is pending", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const t = await renderRoute("clk.slow", { routes, ctx });
    expect(t.route()).toMatchObject({ id: "clk.slow", pending: false });
    t.dispose();
  }, 20_000);
});
