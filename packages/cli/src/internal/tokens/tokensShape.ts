import type { Program } from "oxc-parser";
import type { TokensForm } from "./TokensForm.ts";
import { tokensInit } from "./tokensInit.ts";

/** The form of `tokens` in `program` that an edit can follow, or undefined for any other initializer. */
export function tokensShape(program: Program): TokensForm | undefined {
  const init = tokensInit(program);
  if (init === undefined) return undefined;
  if (init.type === "Identifier") return { init, literal: undefined, alias: init.name };
  if (init.type === "CallExpression" && init.callee.type === "Identifier" && init.callee.name === "defineTokens") {
    const arg = init.arguments[0];
    return arg?.type === "ObjectExpression" && init.arguments.length === 1
      ? { init, literal: arg, alias: undefined }
      : undefined;
  }
  return undefined;
}
