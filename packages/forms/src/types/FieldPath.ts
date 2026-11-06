type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7];
type Leaf = string | number | boolean | bigint | symbol | null | undefined;

/**
 * Every dotted path into `T`: object keys, array indexes (`items.0`), and nested paths (`address.city`).
 * Recursion stops at depth 8.
 */
export type FieldPath<T, D extends number = 8> = [D] extends [never]
  ? never
  : T extends Leaf
    ? never
    : T extends readonly (infer I)[]
      ? `${number}` | `${number}.${FieldPath<NonNullable<I>, Prev[D]>}`
      : {
          [K in keyof T & string]-?: K | `${K}.${FieldPath<NonNullable<T[K]>, Prev[D]>}`;
        }[keyof T & string];
