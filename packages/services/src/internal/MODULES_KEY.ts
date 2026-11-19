/**
 * The `globalThis` key of the bindings `createApp` (`@keel/server`) and a `client` deployable's generated entry write: a
 * `WeakMap` from each ctx to a `Map` of app module id to a base URL or an in-process app `{ fetch }` (k.topology Calls
 * and peers, k.hosting Peers). The writers use the same key; none imports another.
 */
export const MODULES_KEY: unique symbol = Symbol.for("keel.modules");
