// Spec: k.compiler, clause "A literal `poster="javascript:alert(1)"` is E1003, and the same value bound dynamically renders as `about:blank`."
// @vitest-environment happy-dom
// Seed 1337 (no generated inputs; the clause names one value).
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { expect, test } from "vitest";
import { codes, load, sigOf } from "./support.ts";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

const bound = `
import { signal } from '@keel/reactive'
const u = signal('')
function V() {
  return <video poster={u.get()} />
}
V.u = u
export default V
`;

test('A literal `poster="javascript:alert(1)"` is E1003', () => {
  const d = codes(`export default function C() { return <video poster="javascript:alert(1)" /> }`);
  const e = d.find((x) => x.code === "E1003");
  expect(e).toBeDefined();
  // The fix is a unified diff: its added lines must not reintroduce the attribute.
  const added = (e?.fix ?? "").split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++"));
  for (const l of added) expect(l).not.toContain("poster=");
});

test("A literal https poster emits no E1003 (clean counterpart)", () => {
  const d = codes(`export default function C() { return <video poster="https://example.com/p.png" /> }`);
  expect(d.map((x) => x.code)).not.toContain("E1003");
});

test("The same poster value bound dynamically renders as `about:blank`", () => {
  const V = load("V", bound);
  sigOf(V, "u").set("javascript:alert(1)");
  const host = document.createElement("div");
  const dispose = mount(V, host, { ctx: simCtx });
  expect(host.querySelector("video")?.getAttribute("poster")).toBe("about:blank");
  dispose();
});
