// @vitest-environment happy-dom
// k.security Trusted Types: one policy `keel` per realm, shared by every runtime-dom copy; a refused policy throws.
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  Reflect.deleteProperty(globalThis, "trustedTypes");
  Reflect.deleteProperty(globalThis, Symbol.for("keel.trustedTypes"));
});

const install = (refuse = false): string[] => {
  const created: string[] = [];
  const trustedTypes = {
    createPolicy(name: string, rules: { createHTML: (s: string) => string }) {
      if (refuse || created.includes(name)) throw new TypeError(`policy ${name} exists`);
      created.push(name);
      return { createHTML: (s: string) => ({ toString: () => rules.createHTML(s) }) };
    },
  };
  Object.defineProperty(globalThis, "trustedTypes", { value: trustedTypes, configurable: true, writable: true });
  return created;
};

it("a second runtime copy in the realm reuses the policy instead of creating it again", async () => {
  const created = install();
  const first = await import("../src/ops/template.ts");
  first.template('<p id="a">x</p>');
  vi.resetModules();
  const second = await import("../src/ops/template.ts");
  expect(second.template('<p id="b">y</p>').content.children[0]?.id).toBe("b");
  expect(created).toEqual(["keel"]);
});

it("a policy the browser refuses is an Error naming it, not a plain string handed to the sink", async () => {
  install(true);
  vi.resetModules();
  const { template } = await import("../src/ops/template.ts");
  expect(() => template("<p></p>")).toThrow(/policy keel could not be created/);
});
