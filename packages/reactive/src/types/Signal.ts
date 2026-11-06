/** A writable reactive value. Reads inside `computed`/`effect` register a dependency. */
export interface Signal<T> {
  get(): T;
  set(value: T): void;
}
