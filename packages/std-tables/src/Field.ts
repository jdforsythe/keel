/** A field name of the row type `T`; with `V`, only the fields whose values are `V`. */
export type Field<T, V = unknown> = { [K in keyof T & string]-?: T[K] extends V ? K : never }[keyof T & string];
