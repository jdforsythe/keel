import { createCtx } from "@keel/ctx";
import { render } from "../render.ts";
import type { TestComponent } from "../types/TestComponent.ts";

/**
 * One component property case: render `props` twice under sim ctxs with one seed; each render must not throw
 * (render also enforces the axe rules, E1703) and both must give equal a11y trees and store state.
 */
export function checkComponent<P>(component: TestComponent<P>, props: P, seed: number): void {
  const once = (): string => {
    const t = render(component, { props, ctx: createCtx({ mode: "sim", seed }) });
    try {
      return JSON.stringify({ a11y: t.a11y(), state: t.state() });
    } finally {
      t.dispose();
    }
  };
  const first = once();
  const second = once();
  if (first !== second) throw new Error("two renders with one seed differ");
}
