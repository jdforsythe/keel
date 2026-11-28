/** A `WeakSet` whose methods were read when `@keel/schema` was evaluated (k.realm Built-ins). */
export type WeakSetOf<T extends object> = {
  readonly has: (value: T) => boolean;
  readonly add: (value: T) => WeakSetOf<T>;
  readonly delete: (value: T) => boolean;
};
