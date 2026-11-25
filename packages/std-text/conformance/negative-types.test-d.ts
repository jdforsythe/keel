// Negative type test (k.unsafe): type-checked by the package's `check`, never run, imported by no file. Each `@ts-expect-error` line is one claim that a call does not compile; its run-time half sits in
// the named file of conformance/, which makes the same call untyped.
import { formatLiteral, s } from "@keel/schema";
import { Instant, type PlainDate } from "@keel/std-temporal";

export function conformanceNegativeTypes(t: string): void {
  // type-level negatives: each expected-error line asserts the text formats reject a misuse
  // format-literal.test.ts
  // @ts-expect-error a `text` of type `string` is not a literal
  formatLiteral(Instant, t);
  // @ts-expect-error the return type is the format's brand, not another format's
  const p: PlainDate = formatLiteral(Instant, "1970-01-01T00:00:00.000Z");
  // @ts-expect-error `s.string()` is no format type
  formatLiteral(s.string(), "x");
  const ok: Instant = formatLiteral(Instant, "1970-01-01T00:00:00.000Z");
  void [p, ok];
}
