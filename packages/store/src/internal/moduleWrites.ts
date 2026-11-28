/**
 * The check `tx`, `restore` (other than from a waiting snapshot while the store is made), `undo` and `undoWhere` on a
 * store in the module registry run first, before they validate or write anything: `@keel/server`
 * installs one that throws E1256 while it serves a request (k.resume Stores); with none installed every write passes.
 */
export const moduleWrites: { check: ((id: string) => void) | null } = { check: null };
