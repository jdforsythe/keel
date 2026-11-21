// @vitest-environment happy-dom
// Spec: k.component, Slot props "Slot and callback props (`onChange: (v: T) => void`) are typed with the component's props, outside its `Props` schema."
// Seed: 1337.
// Assumed: `render` passes a function-valued prop that `Props` does not name through to the component untouched, as it does a slot prop; the sentence says "typed", so the callback's type is checked at compile time with `expectTypeOf`.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import type { Ctx } from "@keel/ctx";
import * as reactive from "@keel/reactive";
import { type Infer, s } from "@keel/schema";
import { render } from "@keel/testing";
import * as ui from "@keel/ui";
import fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vitest";
import { SEED, simCtx } from "./fixtures.ts";

const SOURCE = `
import { s } from "@keel/schema";
import { Button } from "@keel/ui";
export const Props = s.object({ day: s.string() });
export default function Picker(props: { day: string; onChange: (d: string) => void }) {
  return <Button id="p.pick" onClick={() => props.onChange(props.day)}>Pick</Button>;
}`;
const Props = s.object({ day: s.string() });
type Callback = (d: string) => void;

const build = () => {
  const r = compile([{ path: "Picker.tsx", source: SOURCE }]);
  expect(r.diagnostics).toEqual([]);
  const fn = evaluate(r.outputs[0]?.code ?? "", { "@keel/ui": ui, "@keel/reactive": reactive });
  if (typeof fn !== "function") throw new Error("fixture: no default export");
  return Object.assign(
    (p: { day: string; onChange: Callback }, ctx: Ctx): Node => {
      const node: unknown = fn(p, ctx);
      if (!(node instanceof Node)) throw new Error("fixture: component did not return a Node");
      return node;
    },
    { Props },
  );
};

describe("k.component: a callback prop is typed and kept out of the schema", () => {
  it("the callback is not in `Infer<typeof Props>` and is typed on the component's props", () => {
    expectTypeOf<Infer<typeof Props>>().toEqualTypeOf<{ day: string }>();
    expectTypeOf<Parameters<ReturnType<typeof build>>[0]["onChange"]>().toEqualTypeOf<Callback>();
    const encoded: unknown = Props.encode({ day: "x" });
    expect(encoded).toEqual({ day: "x" });
  });

  it("property: a click calls the callback the test passed with the parsed `day`", async () => {
    const Picker = build();
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z0-9-]{1,10}$/), async (day) => {
        const seen: string[] = [];
        const t = render(Picker, { props: { day, onChange: (d: string) => seen.push(d) }, ctx: simCtx() });
        await t.fire("p.pick", { type: "click" });
        expect(seen).toEqual([day]);
        t.dispose();
      }),
      { seed: SEED, numRuns: 15 },
    );
  });
});
