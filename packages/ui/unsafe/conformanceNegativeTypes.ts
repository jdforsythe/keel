// Type-only fixture for conformance/base-elements-take-no-ctx.test.ts (in unsafe/ because it needs expected-error
// directives): checked by tsc, never run. The conformance file makes the same call untyped.
import { Box, Link } from "@keel/ui";

export function conformanceNegativeTypes(): void {
  // @ts-expect-error a base element takes no second argument
  Box({ as: "main" }, {});
  // link-to-not-href.test.ts
  // @ts-expect-error a string is no `Href`
  Link({ to: "/x", children: "x" });
}
