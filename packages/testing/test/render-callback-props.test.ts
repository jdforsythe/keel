// @vitest-environment happy-dom
// Spec: k.component Slot props (a callback prop is typed and kept out of the schema); k.testing Harness.
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { type TestComponent, render } from "@keel/testing";
import { describe, expect, expectTypeOf, it } from "vitest";

const Props = s.object({ label: s.string() });

function Pick(props: { label: string; onPick: (l: string) => void }): Node {
  const b = document.createElement("button");
  b.id = "pick";
  b.textContent = props.label;
  b.addEventListener("click", () => props.onPick(props.label));
  return b;
}

describe("render takes a component whose props hold a callback beside its Props schema", () => {
  it("types the component by its own props and passes the callback through", async () => {
    const C = Object.assign(Pick, { Props });
    expectTypeOf(C).toMatchTypeOf<TestComponent<{ label: string }, { label: string; onPick: (l: string) => void }>>();
    const seen: string[] = [];
    const t = render(C, {
      props: { label: "a", onPick: (l: string) => seen.push(l) },
      ctx: createCtx({ mode: "sim", seed: 1 }),
    });
    await t.fire("pick", { type: "click" });
    expect(seen).toEqual(["a"]);
    t.dispose();
  });
});
