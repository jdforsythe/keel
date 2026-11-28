import type { Client } from "@keel/services";

type Args<D extends object, K extends keyof D> = Parameters<Client<D>[K]>[0];

/** The call input `send` takes for endpoint `K`: the client's input without `signal`, `bearer` and `body.write`; a secret never reaches the stored outbox. */
export type SendInput<D extends object, K extends keyof D> = {
  readonly [P in keyof Args<D, K> as P extends "signal" | "bearer" ? never : P]: P extends "body"
    ? Omit<Args<D, K>[P], "write">
    : Args<D, K>[P];
};
