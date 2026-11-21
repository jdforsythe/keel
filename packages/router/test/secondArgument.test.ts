// @vitest-environment happy-dom
// k.component: the router calls every layout and page with `(props, ctx)`.
import { createCtx } from "@keel/ctx";
import { contract } from "@keel/router/contract";
import { mount } from "@keel/runtime-dom";
import { expect, it } from "vitest";
import { createRouter } from "../src/createRouter.ts";
import { manifest } from "../src/manifest.ts";
import { memoryHistory } from "./memoryHistory.ts";

const settle = async (): Promise<void> => {
  for (let i = 0; i < 64; i++) await Promise.resolve();
};

it("layouts and pages get the ctx as their second argument", async () => {
  const ctx = createCtx({ mode: "sim" });
  const seen: [string, number, unknown][] = [];
  const c = contract("sa", { "sa.shell": { layout: true }, "sa.page": { path: "/sa" } });
  const routes = manifest(c, {
    "sa.shell": {
      component: (...args: unknown[]) => {
        seen.push(["shell", args.length, args[1]]);
        const e = document.createElement("div");
        const [p] = args;
        const kids = typeof p === "object" && p !== null ? Reflect.get(p, "children") : undefined;
        const kid: unknown = typeof kids === "function" ? kids() : undefined;
        if (kid instanceof Node) e.append(kid);
        return e;
      },
    },
    "sa.page": {
      layout: "sa.shell",
      component: (...args: unknown[]) => {
        seen.push(["page", args.length, args[1]]);
        return document.createElement("p");
      },
    },
  });
  const router = createRouter(routes, { ctx, history: memoryHistory("/sa") });
  const host = document.createElement("div");
  const unmount = mount(router.App, host, { ctx });
  await settle();
  expect(seen.map(([name]) => name).sort()).toEqual(["page", "shell"]);
  for (const [, count, second] of seen) {
    expect(count).toBe(2);
    expect(second).toBe(ctx);
  }
  unmount();
  router.dispose();
});
