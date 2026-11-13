// Spec: k.security, Conformance "With a stub `trustedTypes` global, `template()` passes its HTML through policy `keel`, created once."
// Seed: 1337.
// Untestable here: "a string assigned to any other HTML sink throws" is enforced by the browser's `require-trusted-types-for`, not by a stub.
// @vitest-environment happy-dom
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

type Rules = { createHTML?: (input: string) => unknown };
type Stub = {
  created: string[];
  made: string[];
  install(): void;
};

const KEY = "trustedTypes";

function stub(): Stub {
  const created: string[] = [];
  const made: string[] = [];
  const trustedTypes = {
    createPolicy(name: string, rules: Rules) {
      created.push(name);
      return {
        name,
        createHTML(input: string) {
          made.push(input);
          const out = rules.createHTML?.(input) ?? input;
          return { toString: () => String(out) };
        },
      };
    },
  };
  return {
    created,
    made,
    install() {
      Object.defineProperty(globalThis, KEY, { value: trustedTypes, configurable: true, writable: true });
    },
  };
}

beforeEach(() => {
  vi.resetModules();
});
afterEach(() => {
  Reflect.deleteProperty(globalThis, KEY);
});

const tag = fc.stringMatching(/^[a-z]{3,8}$/);

describe("k.security: Trusted Types in the runtime", () => {
  test("With a stub `trustedTypes` global, `template()` passes its HTML through policy `keel`", async () => {
    await fc.assert(
      fc.asyncProperty(tag, tag, async (id, word) => {
        vi.resetModules();
        const s = stub();
        s.install();
        const { template } = await import("@keel/runtime-dom/ops");
        const html = `<p id="${id}">${word}</p>`;
        const t = template(html);
        expect(s.made).toContain(html);
        expect(t.content.children[0]?.id).toBe(id);
        expect(t.content.children[0]?.textContent).toBe(word);
        expect(s.created).toContain("keel");
        expect(s.created.every((n) => n === "keel")).toBe(true);
      }),
      { seed: 1337, numRuns: 15 },
    );
  });

  test("the policy `keel` is created once however many templates are built", async () => {
    const s = stub();
    s.install();
    const { template } = await import("@keel/runtime-dom/ops");
    for (let i = 0; i < 5; i++) template(`<p id="t${i}"></p>`);
    expect(s.created).toEqual(["keel"]);
    expect(s.made).toHaveLength(5);
  });

  test("without a `trustedTypes` global `template()` still builds its element", async () => {
    const { template } = await import("@keel/runtime-dom/ops");
    expect(template('<p id="x">y</p>').content.children[0]?.textContent).toBe("y");
  });
});
