/**
 * Elements whose text is code or CSS, never data (rfc:0058): `script` and `style`. Their children and attributes
 * are literal only (E1002 otherwise), and the lowering never binds into them.
 */
export const RAW_TEXT_TAGS: ReadonlySet<string> = new Set(["script", "style"]);
