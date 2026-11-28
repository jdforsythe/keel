import type { Statement } from "oxc-parser";

/**
 * Whether a statement never completes normally, so the statements after it in its list do not run from it: a
 * `return`, `throw`, `break` or `continue`, a block holding one at its top level, or an `if` both of whose branches exit.
 */
export function alwaysExits(s: Statement): boolean {
  switch (s.type) {
    case "ReturnStatement":
    case "ThrowStatement":
    case "BreakStatement":
    case "ContinueStatement":
      return true;
    case "BlockStatement":
      return s.body.some(alwaysExits);
    case "IfStatement":
      return s.alternate !== null && alwaysExits(s.consequent) && alwaysExits(s.alternate);
    default:
      return false;
  }
}
