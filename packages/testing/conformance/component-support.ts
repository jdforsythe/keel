// Shared helpers for the k.component conformance that runs under the real harness (not a test file).
// Compiled components come from `compile` + `@keel/compiler/testing` `evaluate`; the harness is `render` from `@keel/testing`.
import { compile } from "@keel/compiler";
import { evaluate } from "@keel/compiler/testing";
import type { Ctx } from "@keel/ctx";
import type { Schema } from "@keel/schema";
import type { TestComponent } from "@keel/testing";
import { expect } from "vitest";

export interface Compiled<P> {
  readonly component: TestComponent<P>;
  /** `ids.json` keys: one per element in source order. */
  readonly ids: readonly string[];
  readonly entries: Readonly<Record<string, { readonly tag: string }>>;
}

/** Compile one component file (zero diagnostics), evaluate it, and attach `Props` the way the compiler does for a file exporting it. */
export function compiled<P>(name: string, source: string, props: Schema<P>): Compiled<P> {
  const r = compile([{ path: `${name}.tsx`, source }]);
  expect(r.diagnostics).toEqual([]);
  const out = r.outputs[0];
  if (out === undefined) throw new Error("fixture: no compiler output");
  const fn = evaluate(out.code);
  if (typeof fn !== "function") throw new Error("fixture: default export is not a component");
  const component = Object.assign(
    (p: P, ctx: Ctx): Node => {
      const node: unknown = fn(p, ctx);
      if (!(node instanceof Node)) throw new Error("fixture: component did not return a Node");
      return node;
    },
    { Props: props },
  );
  const entries = r.artifacts["ids.json"];
  return { component, ids: Object.keys(entries), entries };
}
