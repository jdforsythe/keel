import type { CurrentUser } from "../types/CurrentUser.ts";

/** A `currentUser` that answers `user`, already settled, and runs nothing: `fixed` (k.user). */
export function fixedUser(user: string): CurrentUser {
  const answer = Promise.resolve(user);
  return Object.assign((): Promise<string> => answer, { fixed: true });
}
