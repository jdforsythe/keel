// @vitest-environment happy-dom
// Spec: k.compiler, clause "A dynamic `href` whose value is `javascript:alert(1)` renders as `about:blank`."
// Seed 1337 (fc.assert seed below).
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import fc from "fast-check";
import { expect, test } from "vitest";
import { load, sigOf } from "./support.ts";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

const src = `
import { signal } from '@keel/reactive'
const u = signal('')
function L() {
  return <a href={u.get()}>go</a>
}
L.u = u
export default L
`;

function render(url: string): string | null {
  const L = load("L", src);
  sigOf(L, "u").set(url);
  const host = document.createElement("div");
  const dispose = mount(L, host, { ctx: simCtx });
  const out = host.querySelector("a")?.getAttribute("href") ?? null;
  dispose();
  return out;
}

const allowed = ["http", "https", "mailto", "tel"];

test("A dynamic href whose value is javascript:alert(1) renders as about:blank", () => {
  expect(render("javascript:alert(1)")).toBe("about:blank");
});

test("A dynamic href with any scheme other than http, https, mailto, tel renders as about:blank", () => {
  const scheme = fc.stringMatching(/^[a-z][a-z0-9+.-]{0,8}$/).filter((s) => !allowed.includes(s));
  fc.assert(
    fc.property(scheme, fc.stringMatching(/^[a-z0-9/]{0,10}$/), (sc, rest) => {
      expect(render(`${sc}:${rest}`)).toBe("about:blank");
    }),
    { seed: 1337, numRuns: 50 },
  );
});

test("A dynamic href with scheme http, https, mailto or tel is preserved", () => {
  fc.assert(
    fc.property(fc.constantFrom(...allowed), fc.stringMatching(/^[a-z0-9]{1,10}$/), (sc, rest) => {
      const url = `${sc}:${sc === "http" || sc === "https" ? "//" : ""}${rest}`;
      expect(render(url)).toBe(url);
    }),
    { seed: 1337, numRuns: 30 },
  );
});
