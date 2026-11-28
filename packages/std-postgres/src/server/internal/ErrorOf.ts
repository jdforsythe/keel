import type { KeelError } from "@keel/schema";

/** The error of a result's `err` side, over each member of a union of results (`fn`'s answer in `transaction`). */
export type ErrorOf<R> = R extends { readonly ok: false; readonly error: infer E extends KeelError<string, unknown> }
  ? E
  : never;
