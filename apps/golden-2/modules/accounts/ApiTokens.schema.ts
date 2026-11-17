import { s } from "@keel/schema";
import { ApiToken } from "./ApiToken.schema.ts";

export const ApiTokens = s.object({ tokens: s.array(ApiToken) });

export type ApiTokens = s.infer<typeof ApiTokens>;
