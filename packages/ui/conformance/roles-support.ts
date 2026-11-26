// Shared helpers for the k.roles and k.host-element conformance (not a test file). Public API only. Seed: 1337.
import { scope } from "@keel/reactive";
import * as reactive from "@keel/reactive";
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";

export const SEED = 1337;

const hosts: HTMLElement[] = [];
export const cleanup = (): void => {
  for (const h of hosts.splice(0)) h.remove();
};
export const host = (): HTMLElement => {
  const h = document.createElement("div");
  document.body.appendChild(h);
  hosts.push(h);
  return h;
};
export const render = (make: () => Node): { host: HTMLElement; off: () => void } => {
  const h = host();
  return { host: h, off: mount(make, h, { ctx: createCtx({ mode: "sim", seed: 1337 }) }) };
};
export const byId = (root: ParentNode, id: string): HTMLElement => {
  const el = root.querySelector(`[id="${id}"]`);
  if (!(el instanceof HTMLElement)) throw new Error(`no element ${id}`);
  return el;
};
export const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

/** Signals and computeds are created in a scope (k.reactive E1203). */
const owner = scope(() => undefined);
export const owned = <T>(make: () => T): T => owner.run(make);
export const signal = <T>(v: T) => owned(() => reactive.signal(v));
export const computed = <T>(fn: () => T) => owned(() => reactive.computed(fn));

/** Records each string written to `document.cookie` and forwards it: happy-dom keeps a `Max-Age=0` cookie within the same millisecond, so an expired cookie is shown by what the product writes. */
export function logCookieWrites(): { writes: string[]; stop: () => void } {
  let owner: object | null = Object.getPrototypeOf(document);
  while (owner !== null && Object.getOwnPropertyDescriptor(owner, "cookie") === undefined)
    owner = Object.getPrototypeOf(owner);
  const descriptor = owner === null ? undefined : Object.getOwnPropertyDescriptor(owner, "cookie");
  const writes: string[] = [];
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get: () => descriptor?.get?.call(document) ?? "",
    set: (v: string) => {
      writes.push(v);
      descriptor?.set?.call(document, v);
    },
  });
  return { writes, stop: () => void Reflect.deleteProperty(document, "cookie") };
}
