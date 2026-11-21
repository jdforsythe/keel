import type { Client } from "@keel/services";

type Ok<R> = R extends { readonly ok: true; readonly value: infer O } ? O : never;

/** The output of endpoint `K` of `D`: the `value` of its client method's `ok` answer. */
export type Output<D extends object, K extends keyof D> = Ok<Awaited<ReturnType<Client<D>[K]>>>;
