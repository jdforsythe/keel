import type { SchemaError } from "@keel/schema";

/**
 * The Error `defineTokens` and `combinations` throw for tokens `TokenSchema` refuses: `code: 'E1807'`, the message
 * `<path>: <what>` of the first issue (k.themes Token errors), and the issues.
 */
export function tokensError(error: SchemaError): Error & { code: "E1807"; issues: SchemaError["data"]["issues"] } {
  return Object.assign(new Error(error.message), { code: "E1807" as const, issues: error.data.issues });
}
