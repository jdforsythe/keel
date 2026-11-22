/** A request's `user` and whether a verified `x-keel-user` gave it (no `identify` ran). */
export type RequestUser = { readonly user: string; readonly asserted: boolean };
