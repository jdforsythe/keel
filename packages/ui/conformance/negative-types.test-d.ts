// Negative type test (k.unsafe): type-checked by the package's `check`, never run, imported by no file. Each `@ts-expect-error` line is one claim that a call does not compile; its run-time half sits in
// `conformance/base-elements-take-no-ctx.test.ts`, which makes the same call untyped.
import { Box, Link } from "@keel/ui";

export function conformanceNegativeTypes(): void {
  // type-level negatives: each expected-error line asserts the ui elements reject a misuse
  // @ts-expect-error a base element takes no second argument
  Box({ as: "main" }, {});
  // link-to-not-href.test.ts
  // @ts-expect-error a string is no `Href`
  Link({ to: "/x", children: "x" });
}
