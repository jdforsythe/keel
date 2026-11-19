// Shared helpers for the compiler conformance suite (not a test file). Public API only.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import type { Signal } from "@keel/reactive";
import type { mount } from "@keel/runtime-dom";
import { expect } from "vitest";

export const SEED = 1337;

export type Mountable = Parameters<typeof mount>[0];

export function isMountable(x: unknown): x is Mountable {
  return typeof x === "function";
}

/** Compile one component file, require zero diagnostics, evaluate, and return the default export. */
export function load(name: string, source: string): Mountable {
  const r = compile([{ path: `${name}.tsx`, source }]);
  expect(r.diagnostics).toEqual([]);
  const first = r.outputs[0];
  if (first === undefined) throw new Error("no output");
  const c = evaluate(first.code);
  if (!isMountable(c)) throw new Error("default export is not a component");
  return c;
}

function isSignal(x: unknown): x is Signal<unknown> {
  return (
    typeof x === "object" &&
    x !== null &&
    "get" in x &&
    "set" in x &&
    typeof x.get === "function" &&
    typeof x.set === "function"
  );
}

/** Fixtures expose their signals as static properties on the default export (`C.sig = sig`). */
export function sigOf(c: unknown, key: string): Signal<unknown> {
  if (typeof c === "function" && key in c) {
    const v: unknown = Reflect.get(c, key);
    if (isSignal(v)) return v;
  }
  throw new Error(`fixture exposes no signal '${key}'`);
}

export function codes(source: string, path = "C.tsx", extra: { path: string; source: string }[] = []) {
  return compile([{ path, source }, ...extra]).diagnostics;
}
