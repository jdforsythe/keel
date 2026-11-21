// Type-only fixture for conformance/harness-passes-ctx.test.ts (in unsafe/ because it needs expected-error directives):
// checked by tsc, never run. The conformance file makes the same call untyped.
import type { Ctx } from "@keel/ctx";
import { s } from "@keel/schema";
import { render } from "@keel/testing";

export function conformanceNegativeTypes(): void {
  render(
    // @ts-expect-error the second parameter is `undefined`, which `Ctx` does not fit
    Object.assign((_p: Record<string, never>, _s?: undefined, _c?: Ctx): Node => document.createElement("p"), {
      Props: s.object({}),
    }),
    { props: {} },
  );
}
