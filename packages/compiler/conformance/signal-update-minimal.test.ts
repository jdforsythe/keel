// @vitest-environment happy-dom
// Spec: k.compiler, clause "Updating one signal changes only the DOM nodes bound to it; every other node keeps its identity."
// Seed 1337 (fc.assert seed below).
import { mount } from "@keel/runtime-dom";
import fc from "fast-check";
import { expect, test } from "vitest";
import { load, sigOf } from "./support.ts";

const src = `
import { signal } from '@keel/reactive'
const count = signal(0)
function Counter() {
  return <div><p>{count.get()}</p><span>static</span></div>
}
Counter.count = count
export default Counter
`;

test("Updating one signal changes only the DOM nodes bound to it; every other node keeps its identity", () => {
  const C = load("Counter", src);
  const count = sigOf(C, "count");
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 1_000_000 }), (n) => {
      count.set(0);
      const host = document.createElement("div");
      document.body.append(host);
      const dispose = mount(C, host);
      const all = () => [...host.querySelectorAll("*")];
      const before = all();
      const p = host.querySelector("p");
      const span = host.querySelector("span");
      const text = p?.firstChild;
      const spanText = span?.firstChild;
      count.set(n);
      const after = all();
      expect(after.length).toBe(before.length);
      after.forEach((el, i) => expect(el).toBe(before[i]));
      expect(host.querySelector("p")).toBe(p);
      expect(host.querySelector("span")).toBe(span);
      expect(span?.firstChild).toBe(spanText);
      expect(p?.firstChild).toBe(text); // text node updated in place
      expect(p?.textContent).toBe(String(n));
      expect(span?.textContent).toBe("static");
      dispose();
      host.remove();
    }),
    { seed: 1337, numRuns: 30 },
  );
});
