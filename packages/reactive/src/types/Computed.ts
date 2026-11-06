/** A derived value, recomputed lazily and only when a dependency changed. */
export interface Computed<T> {
  get(): T;
}
