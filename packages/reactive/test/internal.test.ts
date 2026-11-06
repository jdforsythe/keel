// White-box checks on subscription bookkeeping that the public API cannot observe.
import { describe, expect, it } from "vitest";
import { createNode } from "../src/internal/createNode.ts";
import { track } from "../src/internal/track.ts";
import { watch } from "../src/internal/watch.ts";
import { scope } from "../src/scope.ts";

describe("subscription bookkeeping", () => {
  it("disposal removes the effect from its sources' observer lists", () => {
    let observers = -1;
    let after = -1;
    scope(() => {
      const s = createNode(undefined, false, []);
      const inner = scope(() => {
        watch(() => track(s), []);
      });
      observers = s.observers.length;
      inner.dispose();
      after = s.observers.length;
    });
    expect([observers, after]).toEqual([1, 0]);
  });

  it("reading a node twice in one run subscribes once", () => {
    let observers = -1;
    scope(() => {
      const s = createNode(undefined, false, []);
      watch(() => {
        track(s);
        track(s);
      }, []);
      observers = s.observers.length;
    });
    expect(observers).toBe(1);
  });
});
