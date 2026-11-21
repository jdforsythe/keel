/** An own data property of `o` (a getter or a Proxy trap never runs), else `undefined`. */
export const ownValue = (o: object, k: string): unknown => Object.getOwnPropertyDescriptor(o, k)?.value;
