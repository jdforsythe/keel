import type { Infer } from "@keel/schema";
import type { EndpointMap } from "@keel/services";
import type { Store } from "@keel/store";
import type { OutboxState } from "./internal/OutboxState.ts";

declare const endpointsOf: unique symbol;
type State = Store<Infer<typeof OutboxState>>;

/**
 * What `outbox` returns (std.offline): the reads and log of the client store of entries (`get`, `log`, `snapshot`, …),
 * typed by the endpoints map `D` it sends to.
 */
export type Outbox<D extends EndpointMap> = Pick<State, Exclude<keyof State, symbol>> & { readonly [endpointsOf]?: D };
