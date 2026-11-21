import { invariant, store } from "@keel/store";
import { ApiTokens } from "./ApiTokens.schema.ts";
import { addToken } from "./addToken.ts";

/** The API tokens, restored from `ctx.storage` per request: each one's id, digest and the user it acts for. */
export const tokenStores = () => {
  const tokens = store(ApiTokens, { tokens: [] }, { id: "accounts.tokens" });
  invariant(tokens, (state) => new Set(state.tokens.map((t) => t.id)).size === state.tokens.length);
  return { tokens, addToken: addToken(tokens) };
};
