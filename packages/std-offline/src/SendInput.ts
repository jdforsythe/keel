import type { Client, EndpointMap } from "@keel/services";

type Args<D extends EndpointMap, K extends keyof D> = Parameters<Client<D>[K]>[0];

/** The call input `send` takes for endpoint `K`: the client's input without `signal` and without `body.write`. */
export type SendInput<D extends EndpointMap, K extends keyof D> = {
  readonly [P in keyof Args<D, K> as P extends "signal" ? never : P]: P extends "body"
    ? Omit<Args<D, K>[P], "write">
    : Args<D, K>[P];
};
