/**
 * The module registry's ids a `keel dev` reload carried over (`storesReload`): the first store created with one takes
 * the id from the earlier load's store in place of throwing, and the id is then no longer carried.
 */
export const carriedIds: Set<string> = new Set();
