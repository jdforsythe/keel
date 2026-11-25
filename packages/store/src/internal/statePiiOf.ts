/** Per live store, in memory: what `givenPii` returns for it, read when asked. */
export const statePiiOf = new WeakMap<object, () => readonly string[]>();
