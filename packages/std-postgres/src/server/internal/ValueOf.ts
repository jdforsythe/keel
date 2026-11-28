/** The value of a result's `ok` side, over each member of a union of results (`fn`'s answer in `transaction`). */
export type ValueOf<R> = R extends { readonly ok: true; readonly value: infer T } ? T : never;
