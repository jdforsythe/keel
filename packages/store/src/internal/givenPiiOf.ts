/** Per committed log entry, in memory: what `givenPii` returns for it. A dropped entry drops its list. */
export const givenPiiOf = new WeakMap<object, readonly string[]>();
