// @vitest-environment happy-dom
// Spec: k.roles, Conformance "`slider` renders `<input type="range" min max value aria-label>` with no `role` attribute; `valueText` writes `aria-valuetext`; `fire(id, { type: 'input', value: '4' })` calls `onInput(4)`."
// Spec: k.roles, Conformance "Two `radio` parts with one `name` in a `radiogroup`: `fire(id, { type: 'change' })` on the second calls its `onChange` once; neither has a `role` attribute."
// Seed: 1337. The rendering halves are in packages/ui/conformance/roles-native-controls.test.ts; here `fire` runs under the harness.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import type { Ctx } from "@keel/ctx";
import * as reactive from "@keel/reactive";
import type { Slots } from "@keel/runtime-dom";
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import * as aria from "@keel/ui/aria";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, simCtx } from "./fixtures.ts";

const SLIDER = `
import { signal } from "@keel/reactive";
import { Part } from "@keel/ui/aria";
export default function Dial() {
  const seen = signal(-1);
  return (
    <div id="d.root">
      <Part id="d.s" role="slider" label="Size" min={0} max={100} value={0} valueText="zero" onInput={(v: number) => seen.set(v)} />
      <p id="d.out">{seen.get()}</p>
    </div>
  );
}`;
const RADIOS = `
import { signal } from "@keel/reactive";
import { Part } from "@keel/ui/aria";
export default function Sizes() {
  const a = signal(0);
  const b = signal(0);
  return (
    <div id="r.root">
      <Part id="r.g" role="radiogroup" label="Size">
        <Part id="r.a" role="radio" label="Small" name="size" checked={false} onChange={() => a.set(a.get() + 1)} />
        <Part id="r.b" role="radio" label="Large" name="size" checked={false} onChange={() => b.set(b.get() + 1)} />
      </Part>
      <p id="r.na">{a.get()}</p>
      <p id="r.nb">{b.get()}</p>
    </div>
  );
}`;
// `compiled` of component-support.ts evaluates without `@keel/ui/aria`, so the modules are given here.
const build = (name: string, source: string) => {
  const r = compile([{ path: `${name}.tsx`, source }]);
  expect(r.diagnostics).toEqual([]);
  const fn = evaluate(r.outputs[0]?.code ?? "", { "@keel/reactive": reactive, "@keel/ui/aria": aria });
  if (typeof fn !== "function") throw new Error("fixture: no default export");
  const component = Object.assign(
    (_p: Record<string, never>, slots?: Slots, ctx?: Ctx): Node => {
      const node: unknown = fn({}, slots, ctx);
      if (!(node instanceof Node)) throw new Error("fixture: component did not return a Node");
      return node;
    },
    { Props: s.object({}) },
  );
  return { component };
};
const dial = build("Dial", SLIDER);
const sizes = build("Sizes", RADIOS);

describe("k.roles: fire under the harness", () => {
  it("`fire(id, { type: 'input', value: '4' })` on a `slider` calls `onInput(4)`", async () => {
    const t = render(dial.component, { props: {}, ctx: simCtx() });
    await t.fire("d.s", { type: "input", value: "4" });
    expect(t.find("d.out").text).toBe("4");
    t.dispose();
  });

  it("property: `fire` `input` with any integer string calls `onInput` with that number", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 100 }), async (n) => {
        const t = render(dial.component, { props: {}, ctx: simCtx() });
        await t.fire("d.s", { type: "input", value: String(n) });
        expect(t.find("d.out").text).toBe(String(n));
        t.dispose();
      }),
      { seed: SEED, numRuns: 15 },
    );
  });

  it("`find` of a `slider` is a `slider` named by its label", () => {
    const t = render(dial.component, { props: {}, ctx: simCtx() });
    expect(t.find("d.s")).toMatchObject({ role: "slider", name: "Size" });
    t.dispose();
  });

  it("`fire(id, { type: 'change' })` on the second `radio` calls its `onChange` once and not the first's", async () => {
    const t = render(sizes.component, { props: {}, ctx: simCtx() });
    await t.fire("r.b", { type: "change" });
    expect(t.find("r.nb").text).toBe("1");
    expect(t.find("r.na").text).toBe("0");
    t.dispose();
  });

  it("each `radio` is a `radio` named by its label", () => {
    const t = render(sizes.component, { props: {}, ctx: simCtx() });
    expect(t.find("r.a")).toMatchObject({ role: "radio", name: "Small" });
    expect(t.find("r.b")).toMatchObject({ role: "radio", name: "Large" });
    t.dispose();
  });
});
