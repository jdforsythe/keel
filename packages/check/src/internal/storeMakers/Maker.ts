import type { MakerPath } from "./MakerPath.ts";

/**
 * A store maker (k.leave E1107): the argument paths its state schema reads in each call, and the `.pii()` classes the
 * schema holds in the maker's own code, which every call holds too.
 */
export type Maker = { readonly paths: readonly MakerPath[]; readonly classes: ReadonlySet<string> };
