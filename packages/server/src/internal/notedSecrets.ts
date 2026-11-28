import type { Secret } from "@keel/schema";
import { heldMap } from "@keel/schema/internal";
import type { WeakSetOf } from "@keel/schema/internal";

/**
 * Per scope's secret set (`requestSecrets`): the `Secret`s already walked into it (`noteRequestSecrets`), so a later
 * `reveal` of one in the same scope costs one `WeakSet.has`.
 */
export const notedSecrets = heldMap<Set<string>, WeakSetOf<Secret<unknown>>>();
