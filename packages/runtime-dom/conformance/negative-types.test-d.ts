// Negative type test (k.unsafe): type-checked by the package's `check`, never run, imported by no file. Each `@ts-expect-error` line is one claim that a call does not compile; its run-time half sits in
// `conformance/ctx-second-argument.test.ts`, which makes the same call untyped.
import type { Ctx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";

export function conformanceNegativeTypes(container: HTMLElement, ctx: Ctx): void {
  // type-level negatives: each expected-error line asserts mount rejects a misuse
  const view = (): Node => document.createElement("p");
  // @ts-expect-error `ctx` is required in the options
  mount(view, container, {});
  // @ts-expect-error the options are required
  mount(view, container);
  mount(
    // @ts-expect-error the second parameter is `undefined`, which `Ctx` does not fit
    (_p: Record<string, never>, _slots?: undefined, _ctx?: Ctx) => document.createElement("p"),
    container,
    { ctx },
  );
}
