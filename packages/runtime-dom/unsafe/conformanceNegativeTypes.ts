// Type-only fixture for conformance/ctx-second-argument.test.ts (in unsafe/ because it needs expected-error directives):
// checked by tsc, never run. The conformance file makes the same calls untyped.
import type { Ctx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { unsafe } from "./unsafe.ts";

export function conformanceNegativeTypes(container: HTMLElement, ctx: Ctx): void {
  unsafe(
    "type-level negatives: each expected-error line asserts mount rejects a misuse; checked by tsc, never run",
    () => {
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
    },
  );
}
