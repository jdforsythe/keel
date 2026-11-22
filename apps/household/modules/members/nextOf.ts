import type { SignSearch } from "./SignSearch.schema.ts";

/** The `next` search key to carry from one sign-in page to its form post and the other page, when there is one. */
export const nextOf = (search: SignSearch): Record<string, string> =>
  search.next === undefined ? {} : { next: search.next };
