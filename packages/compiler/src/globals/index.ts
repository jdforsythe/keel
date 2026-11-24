// re-exports only. The global-name resolver, shared by the compiler's E1002 and @keel/check's E1601,
// E1603, E1252 and E1451 so both packages resolve names one way, the client reach E1004 and E1571 share, the handler
// binding pass E1551, E1009 and the build's E1007 share, and the artifact serialization and hash `keel check`
// compares `.keel/` files by, and the static reading of a contract the routes.json reader (W1005) and E1111 share.
// Not app-facing.
export { clientReach } from "../internal/clientReach.ts";
export { globalRefs } from "./globalRefs.ts";
export type { Ref } from "./Ref.ts";
export { references } from "./references.ts";
export type { RefTable } from "./RefTable.ts";
export type { ResolvedGlobals } from "./ResolvedGlobals.ts";
export { unwrapExpression } from "./unwrapExpression.ts";
export { canonicalJson } from "../internal/canonicalJson.ts";
export { hashOf } from "../internal/hashOf.ts";
export { sourceForm } from "../internal/sourceForm.ts";
export { sourceHash } from "../internal/sourceHash.ts";
export type { HandlerKind } from "../internal/HandlerKind.ts";
export type { HandlerUse } from "../internal/HandlerUse.ts";
export { clip } from "../internal/clip.ts";
export { fitChain } from "../internal/fitChain.ts";
export { shortPath } from "../internal/shortPath.ts";
export { projectHandlerUses } from "../internal/projectHandlerUses.ts";
export { SERVER_ONLY_NAME } from "../internal/SERVER_ONLY_NAME.ts";
export type { ContractEntryReading } from "../internal/ContractEntryReading.ts";
export type { ContractGap } from "../internal/ContractGap.ts";
export { readContract } from "../internal/readContract.ts";
