// @vitest-environment happy-dom
// Spec: k.identity, clause "`createApp` and `createRouter` given routes in which a copy of an action, made as the first clause makes one, stands for it throw a value whose message starts `E1515` and names the route id and the member, and run nothing."
// Seed 1337 (the copies are a fixed list). This file holds `createRouter`; `createApp` is in packages/server/conformance/identity-copy-create-app.test.ts.
// ASSUMPTION: the spec names no way to put a copy into a route table that `manifest` already built, so the copy is written into the
// binding object `manifest` was given, after `manifest` returned (an untyped `Reflect.set`), as k.identity's `decl.input = B` is written
// after `action` returned. The calls are untyped (Reflect.apply) because a forged value does not type-check.
import { createCtx } from "@keel/ctx";
import { action, createRouter, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { SEED, memoryHistory } from "./fixtures.ts";

const A = s.object({ a: s.string() });
const B = s.object({ b: s.string() });
const c = contract("p", { "p.b": { path: "/b" } });
const view = () => document.createElement("main");

const ownCopy = (v: object): object => {
  const o = Object.create(Object.getPrototypeOf(v));
  for (const k of Reflect.ownKeys(v)) {
    const d = Object.getOwnPropertyDescriptor(v, k);
    if (d !== undefined) Object.defineProperty(o, k, d);
  }
  return o;
};
const copiesOf = (a: object): Array<[string, object]> => [
  ["a spread", { ...a }],
  ["a spread with another input", { ...a, input: B }],
  ["Object.assign onto Object.create(Object.getPrototypeOf(a))", Object.assign(Object.create(Object.getPrototypeOf(a)), a)],
  ["an object given every Reflect.ownKeys key with its descriptor", ownCopy(a)],
  ["new Proxy(a, {})", new Proxy(a, {})],
];

const thrownOf = (fn: () => unknown): string | null => {
  try {
    fn();
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  return null;
};

describe("k.identity: createRouter given routes holding a copy of an action", () => {
  for (const [how] of copiesOf(action(c, "p.b", { input: A }, async () => ok(null)))) {
    it(`createRouter given routes in which ${how} stands for an action throws E1515 naming p.b and POST, and runs nothing`, () => {
      let ran = 0;
      const a = action(c, "p.b", { input: A }, async () => {
        ran += 1;
        return ok(null);
      });
      const entry = { component: view, POST: a };
      const routes = manifest(c, { "p.b": entry });
      const forged = copiesOf(a).find(([h]) => h === how)?.[1];
      expect(Reflect.set(entry, "POST", forged), "the copy was written into the binding").toBe(true);
      const message = thrownOf(() =>
        Reflect.apply(createRouter, undefined, [
          routes,
          { ctx: createCtx({ mode: "sim", seed: SEED }), history: memoryHistory("/b") },
        ]),
      );
      expect(message?.startsWith("E1515"), String(message)).toBe(true);
      expect(message).toContain("p.b");
      expect(message).toContain("POST");
      expect(ran).toBe(0);
    });
  }
});
