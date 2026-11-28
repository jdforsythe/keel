import type { Expression, ObjectExpression } from "oxc-parser";

/** `tokens` of a `tokens.ts`: `defineTokens({...})` (its `literal`), or a bare name (its `alias`). */
export type TokensForm = {
  readonly init: Expression;
  readonly literal: ObjectExpression | undefined;
  readonly alias: string | undefined;
};
