// @vitest-environment happy-dom
// Spec: k.compiler, clause "Reordering a keyed `For` list preserves the DOM node identity of every row."
// Seed 1337
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import fc from "fast-check";
import { expect, test } from "vitest";
import { load, sigOf } from "./support.ts";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

const src = `
import { signal } from '@keel/reactive'
import { For } from '@keel/runtime-dom'
import { s } from '@keel/schema'
export const Item = s.object({ id: s.string(), name: s.string() })
const items = signal([])
function Rows() {
  return <ul><For each={items.get()} key="id">{(item) => <li>{item.name}</li>}</For></ul>
}
Rows.items = items
export default Rows
`;

test("Reordering a keyed For list preserves the DOM node identity of every row", () => {
  const Rows = load("Rows", src);
  const items = sigOf(Rows, "items");
  const ids = fc.uniqueArray(fc.stringMatching(/^[a-z]{1,5}$/), { minLength: 1, maxLength: 8 });
  fc.assert(
    fc.property(
      ids.chain((xs) =>
        fc.tuple(fc.constant(xs), fc.shuffledSubarray(xs, { minLength: xs.length, maxLength: xs.length })),
      ),
      ([xs, perm]) => {
        const rec = (k: string) => ({ id: k, name: `n-${k}` });
        items.set(xs.map(rec));
        const host = document.createElement("div");
        const dispose = mount(Rows, host, { ctx: simCtx });
        const byName = new Map([...host.querySelectorAll("li")].map((li) => [li.textContent, li]));
        expect(byName.size).toBe(xs.length);
        items.set(perm.map(rec));
        const rows = [...host.querySelectorAll("li")];
        expect(rows.map((r) => r.textContent)).toEqual(perm.map((k) => `n-${k}`));
        for (const r of rows) expect(r).toBe(byName.get(r.textContent));
        dispose();
      },
    ),
    { seed: 1337, numRuns: 40 },
  );
});
