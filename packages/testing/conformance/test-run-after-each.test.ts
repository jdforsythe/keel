// @vitest-environment happy-dom
// Spec: k.test-run Disposal "... disposed when that test ends, passed or failed, after its `afterEach` hooks ..."
// Spec: k.test-run Conformance "An `afterEach` hook of the test that made a render finds it in the document; ... "
// Seed: 1337 (n/a: no generated inputs). The cases run in order.
import { render } from "@keel/testing";
import { afterEach, describe, expect, it } from "vitest";
import { VIEW_ID, View, box, simCtx } from "./test-run-support.ts";

type Handle = ReturnType<typeof render>;
let current: Handle | undefined;
const seen: { present: boolean; state: unknown }[] = [];

afterEach(() => {
  if (current === undefined) return;
  seen.push({ present: document.getElementById(VIEW_ID) !== null, state: current.state(box) });
  current = undefined;
});

describe("k.test-run: an afterEach hook sees the render", () => {
  it("a test makes a render and leaves it", () => {
    current = render(View, { props: {}, state: [[box, { n: 3 }]], ctx: simCtx() });
    expect(document.getElementById(VIEW_ID)).not.toBeNull();
  });

  it("the afterEach hook of that test found its element in the document and read t.state(); after the test ends it is gone", () => {
    expect(seen).toEqual([{ present: true, state: { n: 3 } }]);
    expect(document.getElementById(VIEW_ID)).toBeNull();
  });
});
