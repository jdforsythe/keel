// @vitest-environment happy-dom
// Spec: k.test-run Disposal "A handle made outside a test (`beforeAll`, a `describe` body, module scope) is disposed only by `dispose()`, which an `afterAll` makes."
// Spec: k.test-run Conformance "... a render made in `beforeAll` is in the document in each test of its suite and is gone after an `afterAll` `dispose()`."
// Seed: 1337 (n/a: no generated inputs). The cases run in order.
import { render } from "@keel/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { VIEW_ID, View, simCtx } from "./test-run-support.ts";

type Handle = ReturnType<typeof render>;
let shared: Handle | undefined;
let inAfterAll: boolean | undefined;
let afterDispose: boolean | undefined;

describe("k.test-run: a beforeAll render lasts until afterAll disposes it", () => {
  beforeAll(() => {
    shared = render(View, { props: {}, ctx: simCtx() });
  });

  afterAll(() => {
    inAfterAll = document.getElementById(VIEW_ID) !== null;
    shared?.dispose();
    afterDispose = document.getElementById(VIEW_ID) === null;
  });

  it("the render is in the document in the first test of its suite", () => {
    expect(document.getElementById(VIEW_ID)).not.toBeNull();
  });

  it("the render is in the document in the second test too: the first test's end did not dispose it", () => {
    expect(document.getElementById(VIEW_ID)).not.toBeNull();
    expect(shared?.find(VIEW_ID).text).toBe("view");
  });
});

describe("k.test-run: after the suite", () => {
  it("the render was in the document in afterAll and is gone after the afterAll dispose()", () => {
    expect(inAfterAll).toBe(true);
    expect(afterDispose).toBe(true);
    expect(document.getElementById(VIEW_ID)).toBeNull();
  });
});
