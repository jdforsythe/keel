import { transaction } from "@keel/store";
import type { Store } from "@keel/store";
import { ApiToken } from "./ApiToken.schema.ts";
import type { ApiTokens } from "./ApiTokens.schema.ts";

/** Stores a minted token's id and digest; an id already stored leaves the state unchanged. */
export const addToken = (tokens: Store<ApiTokens>) =>
  transaction(tokens, "accounts.addToken", ApiToken, (state, payload) =>
    state.tokens.some((t) => t.id === payload.id) ? state : { tokens: [...state.tokens, payload] },
  );
