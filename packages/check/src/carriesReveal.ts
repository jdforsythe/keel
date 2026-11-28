import type { Argument } from "oxc-parser";
import { revealFlow } from "./internal/revealFlow.ts";
import type { RuleInput } from "./types/RuleInput.ts";

/**
 * Whether the expression `node` of `input.ast` carries a value `reveal` returns (k.privacy-reads Readers), by
 * k.reveal Flow, a local's value read where `node` stands: E1112's walk. Any other call, a parameter and an import
 * end it; one file is read, a helper's body is not.
 */
export function carriesReveal(node: Argument, input: RuleInput): boolean {
  return revealFlow(input.ast)?.carries(node) ?? false;
}
