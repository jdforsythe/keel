// @vitest-environment happy-dom
// Spec: k.identity, clause "With `t = manifest(c, { 'p.b': { component: view, POST: a } })`, `createRouter` and `createApp` (rejecting) given as `routes` `{ ...t }`, `Object.assign({}, t)`, `JSON.parse(JSON.stringify(t))`, `structuredClone(t)` where it can be made, or `{ kind: 'keel.routeTable', contract: c, contracts: [c] }` throw a value whose message starts `E1515` and holds `routes`, and run no loader, action or guard; `routeTable({ ...t })` throws one that starts `E1515`; given `t` itself, each starts."
// Seed 1337 (the copies are a fixed list). This file holds `createApp`; `createRouter` and `routeTable` are in packages/router/conformance/identity-copy-create-router.test.ts.
// "given `t` itself, each starts" is read as: `createApp` given `t` resolves and does not reject with E1515.
// "`structuredClone(t)` where it can be made": a clone the engine cannot make is not a case, and its `it` skips.
import { createCtx } from "@keel/ctx";
import { action, guard, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { err, ok, s } from "@keel/schema";
import { topology } from "@keel/server";
import { describe, expect, it } from "vitest";
import { SEED, createApp } from "./fixtures.ts";

const A = s.object({ a: s.string() });
const Page = s.object({ title: s.string() });
const Denied = s.error("keel.denied", s.object({}));
const c = contract("p", { "p.b": { path: "/b" }, "p.login": { path: "/login" } });
const view = () => document.createElement("main");

const ran = { loader: 0, action: 0, guard: 0 };
const table = () => {
  Object.assign(ran, { loader: 0, action: 0, guard: 0 });
  const a = action(c, "p.b", { input: A }, async () => {
    ran.action += 1;
    return ok(null);
  });
  const l = loader(c, "p.b", { output: Page }, async () => {
    ran.loader += 1;
    return ok({ title: "b" });
  });
  const g = guard({ redirect: "p.login" }, async () => {
    ran.guard += 1;
    return err(Denied.make({}));
  });
  return manifest(c, { "p.b": { component: view, loader: l, guard: g, POST: a }, "p.login": { component: view } });
};

type Copy = readonly [string, (t: object) => unknown];
const COPIES: readonly Copy[] = [
  ["a spread, `{ ...t }`", (t) => ({ ...t })],
  ["`Object.assign({}, t)`", (t) => Object.assign({}, t)],
  ["`structuredClone(t)`", (t) => structuredClone(t)],
  ["a JSON round trip, `JSON.parse(JSON.stringify(t))`", (t) => JSON.parse(JSON.stringify(t))],
  [
    "a hand-written `{ kind: 'keel.routeTable', contract: c, contracts: [c] }`",
    () => ({ kind: "keel.routeTable", contract: c, contracts: [c] }),
  ],
];

const rejectionOf = async (run: () => Promise<unknown>): Promise<string | null> => {
  try {
    await run();
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  return null;
};
const copyOf = (how: string, t: object): { made: true; value: unknown } | { made: false } => {
  const make = COPIES.find(([h]) => h === how)?.[1];
  if (make === undefined) return { made: false };
  try {
    return { made: true, value: make(t) };
  } catch {
    return { made: false };
  }
};
const app = (routes: unknown) =>
  createApp({
    topology: topology({ web: { modules: ["p"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode: "production",
  });

describe("k.identity: createApp given a copy of a route table `manifest` returned", () => {
  for (const [how] of COPIES) {
    it(`createApp given routes that are ${how} rejects with E1515 holding routes, and runs no loader, action or guard`, async ({
      skip,
    }) => {
      const copy = copyOf(how, table());
      if (!copy.made) return skip();
      const message = await rejectionOf(() => app(copy.value));
      expect(message?.startsWith("E1515"), String(message)).toBe(true);
      expect(message).toContain("routes");
      expect(ran).toEqual({ loader: 0, action: 0, guard: 0 });
    });
  }

  it("createApp given `t` itself does not reject with E1515", async () => {
    expect((await rejectionOf(() => app(table())))?.startsWith("E1515") ?? false).toBe(false);
  });
});
