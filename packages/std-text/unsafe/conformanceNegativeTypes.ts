// Type-only fixture for the conformance files (in unsafe/ because it needs expected-error directives): checked by tsc,
// never run. Each case is one claim that a call is a type error; the run-time half sits in the named file of conformance/.
import { formatLiteral, s } from "@keel/schema";
import { Instant, type PlainDate } from "@keel/std-temporal";

export function conformanceNegativeTypes(t: string): void {
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
