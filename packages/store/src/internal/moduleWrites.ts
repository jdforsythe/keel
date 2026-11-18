/**
 * The check a `tx` on a store in the module registry runs first, before it validates or writes anything: `@keel/server`
 * installs one that throws E1256 while it serves a request (k.resume Stores); with none installed every write passes.
 */
export const moduleWrites: { check: ((id: string) => void) | null } = { check: null };
