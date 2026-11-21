/** A wait of a workflow (std.workflows), keyed by its state: after `ms` in that state the instance gets `event` with payload `{}`. */
export type WaitSpec<E extends string> = { readonly ms: number; readonly event: E };
