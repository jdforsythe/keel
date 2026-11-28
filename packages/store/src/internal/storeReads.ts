/**
 * The tap a store calls when it is created, looked up through `stores().get` or read (`get`, `select`, `snapshot`, `log`,
 * `head`): `@keel/server` sets one around each level's server render, so `#k-state` carries only the stores an island
 * level's render touched (k.leave Snapshots); with none set nothing is noted.
 */
export const storeReads: { note: ((id: string) => void) | null } = { note: null };
