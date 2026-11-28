/**
 * The `globalThis` key of the default users `@keel/testing` writes while a `renderRoute` harness with `user` is open
 * (k.user Testing): a `WeakMap` from a ctx to the user a `service({ contract })` call on it that names no `user`
 * carries. The writer uses the same key; neither imports the other.
 */
export const USERS_KEY: unique symbol = Symbol.for("keel.users");
