import { s } from "@keel/schema";
import { TokenInfo } from "./TokenInfo.schema.ts";

/** The signed-in member's API tokens, newest last. */
export const TokenList = s.object({ tokens: s.array(TokenInfo) });
