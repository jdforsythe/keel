// @vitest-environment happy-dom
// Spec: k.identity, clause "With `t = manifest(c, { 'p.b': { component: view, POST: a } })`, `createRouter` and `createApp` (rejecting) given as `routes` `{ ...t }`, `Object.assign({}, t)`, `JSON.parse(JSON.stringify(t))`, `structuredClone(t)` where it can be made, or `{ kind: 'keel.routeTable', contract: c, contracts: [c] }` throw a value whose message starts `E1515` and holds `routes`, and run no loader, action or guard; `routeTable({ ...t })` throws one that starts `E1515`; given `t` itself, each starts."
// Seed 1337 (the copies are a fixed list). This file holds `createRouter` and `routeTable`; `createApp` is in packages/server/conformance/identity-copy-create-app.test.ts.
// The calls are untyped (Reflect.apply) because a forged value does not type-check. "given `t` itself, each starts" is read as: each function, given `t`, does not throw E1515.
// "`structuredClone(t)` where it can be made": a clone the engine cannot make is not a case, and its `it` skips.
import { createCtx } from "@keel/ctx";
import { action, createRouter, guard, loader, manifest, routeTable } from "@keel/router";
import { contract } from "@keel/router/contract";
import { err, ok, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { SEED, memoryHistory } from "./fixtures.ts";

const A = s.object({ a: s.string() });
const Page = s.object({ title: s.string() });
const Denied = s.error("p.denied", s.object({}));
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

const thrownOf = (fn: () => unknown): string | null => {
  try {
    fn();
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
const router = (routes: unknown) =>
  Reflect.apply(createRouter, undefined, [
    routes,
    { ctx: createCtx({ mode: "sim", seed: SEED }), history: memoryHistory("/b") },
  ]);

describe("k.identity: a copy of a route table `manifest` returned", () => {
  for (const [how] of COPIES) {
    it(`createRouter given routes that are ${how} throws E1515 holding routes, and runs no loader, action or guard`, ({ skip }) => {
      const copy = copyOf(how, table());
      if (!copy.made) return skip();
      const message = thrownOf(() => router(copy.value));
      expect(message?.startsWith("E1515"), String(message)).toBe(true);
      expect(message).toContain("routes");
      expect(ran).toEqual({ loader: 0, action: 0, guard: 0 });
    });

    it(`routeTable given ${how} throws E1515`, ({ skip }) => {
      const copy = copyOf(how, table());
      if (!copy.made) return skip();
      const message = thrownOf(() => Reflect.apply(routeTable, undefined, [copy.value]));
      expect(message?.startsWith("E1515"), String(message)).toBe(true);
    });
  }

  it("createRouter given `t` itself does not throw E1515", () => {
    expect(thrownOf(() => router(table()))?.startsWith("E1515") ?? false).toBe(false);
  });

  it("routeTable given `t` itself does not throw E1515", () => {
    expect(thrownOf(() => routeTable(table()))?.startsWith("E1515") ?? false).toBe(false);
  });
});
