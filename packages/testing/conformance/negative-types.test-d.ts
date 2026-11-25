// Negative type test (k.unsafe): type-checked by the package's `check`, never run, imported by no file. Each `@ts-expect-error` line is one claim that a call does not compile; its run-time half sits in
// `conformance/harness-passes-ctx.test.ts`, which makes the same call untyped.
import type { Ctx } from "@keel/ctx";
import { s } from "@keel/schema";
import { render } from "@keel/testing";

export function conformanceNegativeTypes(): void {
  // type-level negative: the expected-error line asserts render rejects a misuse
  render(
    // @ts-expect-error the second parameter is `undefined`, which `Ctx` does not fit
    Object.assign((_p: Record<string, never>, _s?: undefined, _c?: Ctx): Node => document.createElement("p"), {
      Props: s.object({}),
    }),
    { props: {} },
  );
}
