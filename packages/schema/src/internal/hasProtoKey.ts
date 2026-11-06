const FORBIDDEN = ["__proto__", "constructor", "prototype"];

/** True when `x` carries an own key that could poison a prototype chain downstream. */
export function hasProtoKey(x: object): boolean {
  return FORBIDDEN.some((k) => Object.hasOwn(x, k));
}
