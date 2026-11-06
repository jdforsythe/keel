/** The type at dotted path `P` of `T` (see `FieldPath`); never for a path not in `T`. */
export type PathValue<T, P extends string> = T extends readonly (infer I)[]
  ? P extends `${number}.${infer R}`
    ? PathValue<NonNullable<I>, R>
    : P extends `${number}`
      ? I
      : never
  : P extends `${infer K}.${infer R}`
    ? K extends keyof T
      ? PathValue<NonNullable<T[K]>, R>
      : never
    : P extends keyof T
      ? Exclude<T[P], undefined>
      : never;
