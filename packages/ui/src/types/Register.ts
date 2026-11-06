/**
 * Type-level registration of the app's tokens, so style props accept exactly its token names:
 * `declare module '@keel/ui' { interface Register { tokens: typeof tokens } }`.
 * Unregistered, style props use the k.ui example token set.
 */
// biome-ignore lint/suspicious/noEmptyInterface: declaration-merging target for apps
export interface Register {}
