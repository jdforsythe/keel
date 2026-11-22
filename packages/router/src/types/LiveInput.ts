import type { CurrentUser } from "./CurrentUser.ts";
import type { LoaderInput } from "./LoaderInput.ts";

/**
 * What a live loader's `live` is called with (k.server): a loader's input, the stream's `signal` and, from the server,
 * `currentUser()`, the identity source's answer for the request the stream opened with now (k.user).
 */
export type LiveInput = LoaderInput & {
  readonly signal: AbortSignal;
  readonly currentUser?: CurrentUser;
};
