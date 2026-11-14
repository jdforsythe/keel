// @vitest-environment happy-dom
// k.component: the harness calls a component with `undefined` as its second argument and its ctx as the third.
import { createCtx } from "@keel/ctx";
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import { expect, it } from "vitest";

it("render calls the component with `undefined` as its second argument", () => {
  const calls: unknown[][] = [];
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const C = Object.assign(
    (...args: unknown[]): Node => {
      calls.push(args);
      const p = document.createElement("p");
      p.textContent = "hi";
      return p;
    },
    { Props: s.object({}) },
  );
  const t = render(C, { props: {}, ctx });
  expect(calls).toHaveLength(1);
  expect(calls[0]?.[1]).toBeUndefined();
  expect(calls[0]?.[2]).toBe(ctx);
  t.dispose();
});
