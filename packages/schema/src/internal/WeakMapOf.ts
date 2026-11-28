/** A `WeakMap` whose methods were read when `@keel/schema` was evaluated (k.realm Built-ins). */
export type WeakMapOf<K extends object, V> = {
  readonly get: (key: K) => V | undefined;
  readonly set: (key: K, value: V) => WeakMapOf<K, V>;
  readonly has: (key: K) => boolean;
  readonly delete: (key: K) => boolean;
};
