/**
 * The `globalThis` key of the bindings `createApp` (`@keel/server`) writes: a `WeakMap` from each ctx it serves to a
 * `Map` of app module id to a peer's base URL or an in-process app `{ fetch }` (k.topology Calls and peers).
 * `@keel/server` writes the same key; neither package imports the other.
 */
export const MODULES_KEY: unique symbol = Symbol.for("keel.modules");
