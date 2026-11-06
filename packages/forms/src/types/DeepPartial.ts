/** Form values while editing: every key at every depth may be absent. */
export type DeepPartial<T> = T extends readonly (infer I)[]
  ? DeepPartial<I>[]
  : T extends string | number | boolean | null | undefined
    ? T
    : { [K in keyof T]?: DeepPartial<T[K]> };
