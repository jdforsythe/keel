// @vitest-environment happy-dom
// Spec: k.compiler, clause "A string containing `<script>` or `"><img onerror=x>` rendered as a child or attribute value appears verbatim as text or attribute value and creates no element."
// Seed 1337 (fc.assert seed below).
import { mount } from "@keel/runtime-dom";
import fc from "fast-check";
import { expect, test } from "vitest";
import { load, sigOf } from "./support.ts";

const src = `
import { signal } from '@keel/reactive'
const v = signal('')
function X() {
  return <div><p title={v.get()}>{v.get()}</p></div>
}
X.v = v
export default X
`;

const hostile = fc.oneof(
  fc.constantFrom("<script>alert(1)</script>", '"><img onerror=x>', "<script>", "'><svg onload=x>", "&lt;b&gt;"),
  fc.string(),
  fc.tuple(fc.string(), fc.constantFrom("<script>", '"><img onerror=x>'), fc.string()).map((t) => t.join("")),
);

test('A string containing <script> or "><img onerror=x> rendered as a child or attribute value appears verbatim as text or attribute value and creates no element', () => {
  const X = load("X", src);
  const v = sigOf(X, "v");
  fc.assert(
    fc.property(hostile, (str) => {
      v.set(str);
      const host = document.createElement("div");
      const dispose = mount(X, host);
      const p = host.querySelector("p");
      expect(p?.textContent).toBe(str);
      expect(p?.getAttribute("title")).toBe(str);
      expect(p?.children.length).toBe(0);
      expect(host.querySelectorAll("*").length).toBe(2);
      expect(host.querySelector("script,img,svg,b")).toBeNull();
      dispose();
    }),
    { seed: 1337, numRuns: 100 },
  );
});
