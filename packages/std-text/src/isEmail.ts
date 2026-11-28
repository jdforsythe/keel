const ATOM = "[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+";
const LABEL = "[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?";
const EMAIL = new RegExp(`^(?=[^@]{1,64}@)${ATOM}(?:\\.${ATOM})*@(?:${LABEL}\\.)+[A-Za-z]{1,63}$`);

/**
 * The `check` of `Email` (std.text): ASCII `local@domain` of at most 254 characters; `local` 1 to 64 characters of
 * dot-separated atoms; `domain` two or more dot-separated labels of 1 to 63 letters, digits and inner hyphens, the last
 * all letters.
 */
export function isEmail(v: string): boolean {
  return v.length <= 254 && EMAIL.test(v);
}
