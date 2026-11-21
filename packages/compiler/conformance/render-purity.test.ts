// @vitest-environment happy-dom
// Seed 1337 (fc.assert seed below).
// Compiled stand-in only (compiler precedes testing in deps order, S0003). The harness assertions (find, a11y snapshot, real base elements) are packages/testing/conformance/component-*.test.ts (rfc:0021).
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import fc from "fast-check";
import { expect, test } from "vitest";
import { load } from "./support.ts";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

const src = `
function Card(props) {
  return <section id="card"><h1>{props.title}</h1><p title={props.note}>{props.count}</p></section>
}
export default Card
`;

test("Render is pure for equal props and state: mounting twice with the same props yields equal innerHTML", () => {
  const Card = load("Card", src);
  fc.assert(
    fc.property(fc.string(), fc.string(), fc.integer(), (title, note, count) => {
      // Props are supplied to the fixture by the test through the mount-time props object of the generated wrapper.
      const wrap = Object.assign(() => Card({ title, note, count }, simCtx), {});
      const a = document.createElement("div");
      const b = document.createElement("div");
      const da = mount(wrap, a, { ctx: simCtx });
      const db = mount(wrap, b, { ctx: simCtx });
      expect(a.innerHTML).toBe(b.innerHTML);
      da();
      db();
    }),
    { seed: 1337, numRuns: 50 },
  );
});
