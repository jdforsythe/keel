import { tokens } from "../tokens.ts";

/**
 * What the catalog's harness renders check against beyond axe-core (k.testing): the app's tokens, for render contrast
 * (E1804). `.keel/a11y.json` (E1702) is left out: it records a `Box` with `label` as named from nothing, while the
 * element carries `aria-label`.
 */
export const artifacts = { tokens };
