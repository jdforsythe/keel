// re-exports only. The rfc:0053 global-name resolver, shared by the compiler's E1002 and @keel/check's E1601,
// E1603, E1252 and E1451 so both packages resolve names one way (rfc:0058). Not app-facing.
export { globalRefs } from "./globalRefs.ts";
export type { Ref } from "./Ref.ts";
export { references } from "./references.ts";
export type { RefTable } from "./RefTable.ts";
export type { ResolvedGlobals } from "./ResolvedGlobals.ts";
export { unwrapExpression } from "./unwrapExpression.ts";
