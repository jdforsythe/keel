// @vitest-environment happy-dom
// k.testing, Rules "E1702 rendered role or name differs from `a11y.json`"
// Seed: 1337.
// The artifact is the real compiler output for a small component; mismatches are made by patching its entry.
import { compile } from "@keel/compiler";
import type { A11yEntry } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import type { Ctx } from "@keel/ctx";
import { signal } from "@keel/reactive";
import { attr, clone, on, template } from "@keel/runtime-dom/ops";
import { s } from "@keel/schema";
import { render } from "@keel/testing";
import type { TestComponent } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, codeOf, messageOf, simCtx, thrown } from "./fixtures.ts";

type A11yJson = Record<string, A11yEntry>;

const built = (() => {
  const r = compile([
    { path: "A.tsx", source: `export default function A() { return <div><button id="save">Save</button></div> }` },
  ]);
  expect(r.diagnostics).toEqual([]);
  const out = r.outputs[0];
  if (out === undefined) throw new Error("fixture: no compiler output");
  const fn = evaluate(out.code);
  if (typeof fn !== "function") throw new Error("fixture: default export is not a component");
  const component: TestComponent<Record<string, never>> = Object.assign(
    (p: Record<string, never>, ctx: Ctx): Node => {
      const node: unknown = fn(p, ctx);
      if (!(node instanceof Node)) throw new Error("fixture: component did not return a Node");
      return node;
    },
    { Props: s.object({}) },
  );
  const a11y: A11yJson = r.artifacts["a11y.json"];
  return { component, a11y };
})();
const { component: Compiled, a11y: real } = built;

const patched = (patch: Partial<A11yEntry>): A11yJson => {
  const entry = real.save;
  if (entry === undefined) throw new Error("fixture: no a11y entry for save");
  return { ...real, save: { ...entry, ...patch } };
};

// A hand-written button whose accessible-name source changes on click: text -> aria-label.
const T = template('<div><button id="b" data-k="b">Go</button></div>');
const Renamer = Object.assign(
  (_props: Record<string, never>): Node => {
    const root = clone(T);
    const el = root instanceof Element ? root.querySelector("#b") : null;
    if (el === null) throw new Error("fixture: no #b");
    const label = signal<string | null>(null);
    attr(el, "aria-label", () => label.get());
    on("b", "click", () => label.set("Renamed"));
    return root;
  },
  { Props: s.object({}) },
);
const renamerA11y: A11yJson = { b: { name: "text", role: "button", tag: "button" } };

const ROLES = ["button", "link", "heading", "region", "generic", "presentation", "cell", "listitem", "img"] as const;
const NAMES = ["label", "alt", "text", "aria", "none"] as const;

describe("k.testing: E1702 rendered role or name differs from a11y.json", () => {
  it("E1702 a render that agrees with the compiler's a11y.json does not throw", async () => {
    const e = await thrown(() => {
      render(Compiled, { props: {}, ctx: simCtx(), artifacts: { "a11y.json": real } }).dispose();
    });
    expect(e).toBeUndefined();
  });

  it("E1702 for any other role in the artifact, the first render fails with E1702 naming the element id", async () => {
    const actual = real.save?.role;
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...ROLES).filter((r) => r !== actual),
        async (role) => {
          const e = await thrown(() =>
            render(Compiled, { props: {}, ctx: simCtx(), artifacts: { "a11y.json": patched({ role }) } }),
          );
          expect(codeOf(e)).toBe("E1702");
          expect(messageOf(e)).toContain("save");
        },
      ),
      { seed: SEED, numRuns: 30 },
    );
  });

  it("E1702 for any other name source in the artifact, the first render fails with E1702 naming the element id", async () => {
    const actual = real.save?.name;
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...NAMES).filter((n) => n !== actual),
        async (name) => {
          const e = await thrown(() =>
            render(Compiled, { props: {}, ctx: simCtx(), artifacts: { "a11y.json": patched({ name }) } }),
          );
          expect(codeOf(e)).toBe("E1702");
          expect(messageOf(e)).toContain("save");
        },
      ),
      { seed: SEED, numRuns: 30 },
    );
  });

  it("E1702 a fire that changes the name source of an element makes fire reject with E1702 naming the id", async () => {
    const t = render(Renamer, { props: {}, ctx: simCtx(), artifacts: { "a11y.json": renamerA11y } });
    const e = await thrown(() => t.fire("b", { type: "click" }));
    expect(codeOf(e)).toBe("E1702");
    expect(messageOf(e)).toContain("b");
    t.dispose();
  });

  it("E1702 is not checked when no artifacts option is given", async () => {
    const t = render(Renamer, { props: {}, ctx: simCtx() });
    expect(await thrown(() => t.fire("b", { type: "click" }))).toBeUndefined();
    t.dispose();
    render(Compiled, { props: {}, ctx: simCtx() }).dispose();
  });
});
