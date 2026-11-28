import { type Finding, type RuleDef, defineRule, outputSchemas, schemaHolds } from "@keel/check";

const DIGESTED = [{ from: "@keel/std-tokens", name: "Digested" }] as const;

/**
 * E2203 (std.tokens, k.check registry): an `output` the file declares (`outputSchemas`, k.privacy-reads: a page or
 * layout `loader`'s, an API entry's) for which `schemaHolds` of `Digested` is `'yes'`, at the `output` expression. A
 * digest belongs in a store, never in an answer. An `output` the reader cannot see through reports nothing. No fix.
 */
export const digestOutput: RuleDef = defineRule({
  code: "E2203",
  see: "std.tokens",
  message: "Digested in an output; a token's digest stays in the store",
  explain:
    "A digest is what check compares a presented token with, so it never leaves the server. " +
    "Fix: send the fields the client needs: output: s.object({ id: s.string(), expiresAt: s.number() }).",
  check: (input): Finding[] =>
    outputSchemas(input)
      .filter((o) => schemaHolds(o.expr, input, DIGESTED) === "yes")
      .map((o) => ({ path: input.file.path, line: o.line, col: o.col })),
});
