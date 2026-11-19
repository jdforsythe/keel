/** True when `props[key]` is a getter: a compiled expression, which may change after the first render (k.component). */
export function isGetter(props: object, key: string): boolean {
  return Object.getOwnPropertyDescriptor(props, key)?.get !== undefined;
}
