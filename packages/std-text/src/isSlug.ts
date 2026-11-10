const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The `check` of `Slug` (std.text): 1 to 64 characters of `a-z` and `0-9` in hyphen-separated runs. */
export function isSlug(v: string): boolean {
  return v.length <= 64 && SLUG.test(v);
}
