// @vitest-environment happy-dom
// Seed 1337 (fc.assert seed below).
// Mounted-DOM stand-in (compiler precedes testing in deps order, S0003). Resolution through the harness find(id) is packages/testing/conformance/compiler-ids-find.test.ts (rfc:0033) and component-ids-find.test.ts (rfc:0021).
import { createCtx } from "@keel/ctx";
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import { mount } from "@keel/runtime-dom";
import fc from "fast-check";
import { expect, test } from "vitest";
import { isMountable } from "./support.ts";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

function build(name: string, body: string) {
  const r = compile([{ path: `${name}.tsx`, source: `export default function ${name}() { return ${body} }` }]);
  expect(r.diagnostics).toEqual([]);
  const out = r.outputs[0];
  if (out === undefined) throw new Error("no output");
  const C = evaluate(out.code);
  if (!isMountable(C)) throw new Error("not a component");
  const host = document.createElement("div");
  document.body.append(host);
  const dispose = mount(C, host, { ctx: simCtx });
  return { ids: Object.keys(r.artifacts["ids.json"]), entries: r.artifacts["ids.json"], host, dispose };
}

test("ids.json has exactly one entry per element in source, and each key is an id that resolves to an element (explicit id)", () => {
  const { ids, host, dispose } = build("Cart", `<div><button id="cart.submit">Go</button><span>x</span></div>`);
  expect(ids.length).toBe(3);
  expect(ids).toContain("cart.submit");
  expect(host.querySelectorAll("*").length).toBe(3);
  for (const id of ids) expect(document.getElementById(id)).not.toBeNull();
  expect(document.getElementById("cart.submit")?.tagName.toLowerCase()).toBe("button");
  dispose();
  host.remove();
});

test("ids.json derived ids have the form <file>.<index>, are unique, and resolve in the mounted DOM", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 8 }), (n) => {
      const kids = Array.from({ length: n }, (_, i) => `<span>k${i}</span>`).join("");
      const { ids, entries, host, dispose } = build("List", `<div>${kids}</div>`);
      expect(ids.length).toBe(n + 1);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) {
        expect(id).toMatch(/^List\.\d+$/);
        const el = document.getElementById(id);
        expect(el).not.toBeNull();
        expect(el?.tagName.toLowerCase()).toBe(entries[id]?.tag);
      }
      dispose();
      host.remove();
    }),
    { seed: 1337, numRuns: 20 },
  );
});
