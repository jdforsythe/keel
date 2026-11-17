/**
 * One matcher of the log scrub (`matcherOf`): `head` is global and finds where a value may start; each of `tail`, sticky,
 * must then match right after the one before it. A value short enough for one expression has no `tail`.
 */
export interface Probe {
  readonly head: RegExp;
  readonly tail: readonly RegExp[];
}
