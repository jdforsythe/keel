/**
 * The `globalThis` key of the module bindings `createApp` writes for the modules' service clients (`@keel/services` reads the
 * same key; neither package imports the other): a `WeakMap` from each served ctx to a `Map` of app module id to a peer's
 * base URL or an in-process app `{ fetch }` (k.topology Calls and peers).
 */
export const MODULES_KEY: unique symbol = Symbol.for("keel.modules");
