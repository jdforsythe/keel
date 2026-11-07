import { isHref } from "../src/internal/isHref.ts";
import type { Href } from "../src/types/Href.ts";

/** Test-only: a literal path as an `Href`, for a `Form` written inline in the manifest that it posts to. */
export const to = (u: string): Href => {
  if (!isHref(u)) throw new Error(`not an Href: ${u}`);
  return u;
};
