import { tx } from "@keel/store";
// @vitest-environment happy-dom
// Spec: k.test-run Disposal "A handle already disposed is not disposed again, so a write after a hand `dispose()` stays; a second `dispose()` does nothing, and a disposed handle's methods are E1705."
// Spec: k.test-run Conformance "Disposed by hand and the store written after it in the same test: the next test reads the write, and a second `dispose()` throws nothing."
// Seed: 1337 (n/a: no generated inputs). The cases run in order.
import { render } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { View, box, bump, simCtx } from "./test-run-support.ts";

describe("k.test-run: a hand dispose() is not repeated at test end", () => {
  it("a render disposed by hand, then its seeded store written in the same test, keeps the write; a second dispose() throws nothing", () => {
    const t = render(View, { props: {}, state: [[box, { n: 5 }]], ctx: simCtx() });
    t.dispose();
    expect(box.snapshot().state).toEqual({ n: 0 });
    tx(bump, {});
    expect(box.snapshot().state).toEqual({ n: 1 });
    expect(() => t.dispose()).not.toThrow();
    expect(box.snapshot().state).toEqual({ n: 1 });
  });

  it("the next test reads the written value: the end of the first test restored nothing a second time", () => {
    expect(box.snapshot().state).toEqual({ n: 1 });
  });
});
