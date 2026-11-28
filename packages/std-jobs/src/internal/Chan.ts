/** Per storage key: the tail of its serialized writes, a wake version, and the runners waiting for a wake. */
export type Chan = { tail: Promise<void>; v: number; readonly wake: Set<() => void> };
