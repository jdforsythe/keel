import type { Action, Loader } from "@keel/router";
import type { ChannelEvent } from "../ChannelEvent.ts";

/**
 * The API route `channelRoute` returns (k.api), for the serving module's manifest: list `{ api: true, path, loader }`
 * under `id` and pass `actions` to `routes.actions`. `loader` is the live loader (the event stream); `actions.POST`
 * publishes.
 */
export interface ChannelRoute<M, S> {
  readonly id: string;
  readonly path: string;
  readonly loader: Loader<ChannelEvent<M>, unknown, unknown, S>;
  readonly actions: { readonly POST: Action<unknown, unknown, S> };
}
