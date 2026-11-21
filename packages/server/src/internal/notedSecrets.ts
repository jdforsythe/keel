import type { Secret } from "@keel/schema";

/**
 * Per scope's secret set (`requestSecrets`): the `Secret`s already walked into it (`noteRequestSecrets`), so a later
 * `reveal` of one in the same scope costs one `WeakSet.has`.
 */
export const notedSecrets = new WeakMap<Set<string>, WeakSet<Secret<unknown>>>();
