import type { CurrentUser } from "../types/CurrentUser.ts";

/** A `currentUser` that asks the identity source each call (k.user): not `fixed`. */
export function judgedUser(ask: () => Promise<string>): CurrentUser {
  return Object.assign((): Promise<string> => ask(), { fixed: false });
}
