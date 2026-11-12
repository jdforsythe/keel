import type { Infer } from "@keel/schema";
import type { EndpointMap } from "@keel/services";
import type { Store } from "@keel/store";
import type { OutboxState } from "./internal/OutboxState.ts";

declare const endpointsOf: unique symbol;

/** What `outbox` returns (std.offline): the client store of entries, typed by the endpoints map `D` it sends to. */
export type Outbox<D extends EndpointMap> = Store<Infer<typeof OutboxState>> & { readonly [endpointsOf]?: D };
