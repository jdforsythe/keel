// @vitest-environment happy-dom
// k.component: the harness calls a component with its ctx as the second argument; k.testing: its handle exposes it.
import { type Ctx, createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { render, renderRoute } from "@keel/testing";
import { expect, it } from "vitest";

it("render calls the component with its ctx as the second argument", () => {
  const calls: unknown[][] = [];
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const C = Object.assign(
    (...args: unknown[]): Node => {
      calls.push(args);
      const p = document.createElement("p");
      p.textContent = "hi";
      return p;
    },
    { Props: s.object({}) },
  );
  const t = render(C, { props: {}, ctx });
  expect(calls).toHaveLength(1);
  expect(calls[0]?.[1]).toBe(ctx);
  t.dispose();
});

it("the handle's ctx is the one the component runs on: given, or the sim ctx made for it", () => {
  const seen: unknown[] = [];
  const C = Object.assign(
    (_p: unknown, ctx: unknown): Node => {
      seen.push(ctx);
      return document.createElement("p");
    },
    { Props: s.object({}) },
  );
  const given = createCtx({ mode: "sim", seed: 7 });
  const a = render(C, { props: {}, ctx: given });
  expect(a.ctx).toBe(given);
  a.dispose();
  const b = render(C, { props: {} });
  expect(b.ctx).toBe(seen[1]);
  expect(b.ctx).not.toBe(given);
  b.dispose();
});

it("a renderRoute handle's ctx is the one its app runs on", async () => {
  const c = contract("sa", { "sa.home": { path: "/" } });
  const seen: Ctx[] = [];
  const routes = manifest(c, {
    "sa.home": {
      component: (_p, ctx) => {
        seen.push(ctx);
        return document.createElement("main");
      },
    },
  });
  const given = createCtx({ mode: "sim", seed: 7 });
  const a = await renderRoute("sa.home", { routes, params: {}, ctx: given });
  expect(a.ctx).toBe(given);
  expect(seen.at(-1)).toBe(given);
  a.dispose();
  const b = await renderRoute("sa.home", { routes, params: {} });
  expect(b.ctx).toBe(seen.at(-1));
  expect(b.ctx).not.toBe(given);
  b.dispose();
});
