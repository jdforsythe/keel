// @vitest-environment happy-dom
// Property seed: 1337. k.errors Boundaries: the root fallback holds `keel.unexpected`, or with `mode: 'dev'` the message.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { rootFallback } from "../src/internal/rootFallback.ts";
import type { UnexpectedError } from "../src/types/UnexpectedError.ts";
import { SEED } from "./support.ts";

const unexpected = (message: string, at: string): UnexpectedError => ({
  code: "keel.unexpected",
  message,
  data: { at },
});

describe("rootFallback: the root Boundary's fallback element", () => {
  it("in production (the default) it holds only the code, whatever the message", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), fc.constantFrom(undefined, "production" as const), (message, at, mode) => {
        const pre = rootFallback(unexpected(message, at), mode);
        expect(pre.nodeName).toBe("PRE");
        expect(pre.textContent).toBe("keel.unexpected");
        expect(pre instanceof Element ? pre.getAttribute("data-k-error") : null).toBe(at);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("in dev it holds the message as text", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (message, at) => {
        const pre = rootFallback(unexpected(message, at), "dev");
        expect(pre.textContent).toBe(message);
        expect(pre.childNodes.length).toBeLessThanOrEqual(1);
        expect(pre instanceof Element ? pre.getAttribute("data-k-error") : null).toBe(at);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("a message that looks like markup stays text in dev", () => {
    const pre = rootFallback(unexpected("<img src=x onerror=alert(1)>", "a"), "dev");
    expect(pre instanceof Element ? pre.querySelector("img") : "not an element").toBeNull();
  });
});
