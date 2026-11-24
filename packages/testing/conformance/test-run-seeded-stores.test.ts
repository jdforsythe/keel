// @vitest-environment happy-dom
// Spec: k.test-run Disposal "... its seeded stores are restored."
// Spec: k.test-run Conformance "A `render` given `state: [[store, v]]` and never disposed: the next test reads the store's value from before the render."
// Seed: 1337 (n/a: no generated inputs). The cases run in order.
import { render } from "@keel/testing";
import { describe, expect, it } from "vitest";
import { View, box, simCtx } from "./test-run-support.ts";

describe("k.test-run: seeded stores are restored at test end", () => {
  it("a render given state and never disposed holds the seeded value while the test runs", () => {
    expect(box.snapshot().state).toEqual({ n: 0 });
    const t = render(View, { props: {}, state: [[box, { n: 7 }]], ctx: simCtx() });
    expect(t.state(box)).toEqual({ n: 7 });
    expect(box.snapshot().state).toEqual({ n: 7 });
  });

  it("in the next test the store's snapshot holds the value from before the render", () => {
    expect(box.snapshot().state).toEqual({ n: 0 });
  });
});
