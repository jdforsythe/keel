// Spec: k.realm, clause "After `Reflect.set(WeakSet.prototype, 'has', () => true)`, `Reflect.set(WeakMap.prototype, 'has', () => true)` and `Reflect.set(WeakMap.prototype, 'get', () => ({}))` in a module evaluated after the kernel: `isSchema({})`, `isStore({})`, `isDefect(new Error('x'))` and `isRouteTable({})` are false, and `manifest` given `{ ...a }` for an action `a` throws a value whose message starts `E1515`."
// @vitest-environment happy-dom
// Seed 1337 (no generated input). The kernel packages are imported first (static imports), so the patches below are made after the kernel evaluated.
// The patches live only while the guards are called, and each case restores them in `finally` before any assertion runs: the test runner itself uses `WeakMap`.
import { action, isRouteTable, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { isDefect, isSchema, ok, s } from "@keel/schema";
import { isStore } from "@keel/store";
import { describe, expect, it } from "vitest";

type Saved = { target: object; key: string; descriptor: PropertyDescriptor | undefined };
const patch = (target: object, key: string, value: unknown): Saved => {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  Reflect.set(target, key, value);
  return { target, key, descriptor };
};
const restore = (saved: readonly Saved[]): void => {
  for (const { target, key, descriptor } of saved)
    if (descriptor !== undefined) Object.defineProperty(target, key, descriptor);
};

describe("k.realm Built-ins: a later write to WeakSet or WeakMap changes no guard", () => {
  it("after `Reflect.set(WeakSet.prototype, 'has', () => true)`, `Reflect.set(WeakMap.prototype, 'has', () => true)` and `Reflect.set(WeakMap.prototype, 'get', () => ({}))`, `isSchema({})`, `isStore({})`, `isDefect(new Error('x'))` and `isRouteTable({})` are false, and `manifest` given `{ ...a }` for an action `a` throws a value whose message starts `E1515`", () => {
    const c = contract("p", { "p.b": { path: "/b" } });
    const a = action(c, "p.b", { input: s.object({ a: s.int() }) }, async () => ok(null));
    const err = new Error("x");
    const saved: Saved[] = [];
    let answers: boolean[] = [];
    let message: unknown;
    try {
      saved.push(patch(WeakSet.prototype, "has", () => true));
      saved.push(patch(WeakMap.prototype, "has", () => true));
      saved.push(patch(WeakMap.prototype, "get", () => ({})));
      answers = [isSchema({}), isStore({}), isDefect(err), isRouteTable({})];
      try {
        Reflect.apply(manifest, undefined, [
          c,
          { "p.b": { component: () => document.createElement("main"), POST: { ...a } } },
        ]);
      } catch (e) {
        message = e instanceof Error ? e.message : e;
      }
    } finally {
      restore(saved);
    }
    expect(answers).toEqual([false, false, false, false]);
    expect(typeof message === "string" && message.startsWith("E1515")).toBe(true);
  });

  it("a write to `globalThis.WeakSet` and `globalThis.WeakMap` changes no guard", () => {
    const saved: Saved[] = [];
    let answers: boolean[] = [];
    try {
      saved.push(
        patch(
          globalThis,
          "WeakSet",
          class Everything {
            has = () => true;
            add = () => this;
          },
        ),
      );
      saved.push(
        patch(
          globalThis,
          "WeakMap",
          class Everything {
            has = () => true;
            get = () => ({});
            set = () => this;
          },
        ),
      );
      answers = [isSchema({}), isStore({}), isDefect(new Error("x")), isRouteTable({})];
    } finally {
      restore(saved);
    }
    expect(answers).toEqual([false, false, false, false]);
  });
});
