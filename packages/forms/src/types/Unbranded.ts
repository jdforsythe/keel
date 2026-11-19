/**
 * A form field's working type: a format type (`Format<T, N>`) reads and writes as its base primitive, since the field
 * holds input before `check` has accepted it. Other types are unchanged.
 */
export type Unbranded<T> = T extends { readonly __format: unknown }
  ? T extends string
    ? string
    : T extends number
      ? number
      : T extends boolean
        ? boolean
        : T
  : T;
