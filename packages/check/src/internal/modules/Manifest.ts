import type { ManifestList } from "./ManifestList.ts";
import type { StdEntry } from "./StdEntry.ts";

/** A `module({...})` manifest read statically from its literal object (k.module). */
export type Manifest = {
  readonly id: string | null;
  readonly deps: ManifestList;
  readonly capabilities: ManifestList;
  readonly exports: ManifestList;
  readonly routes: ManifestList;
  /** `std` config entries in source order (RFC 0047); empty when absent. */
  readonly std: readonly StdEntry[];
};
