import type { ManifestList } from "./ManifestList.ts";

/** A `module({...})` manifest read statically from its literal object (k.module). */
export type Manifest = {
  readonly id: string | null;
  readonly deps: ManifestList;
  readonly capabilities: ManifestList;
  readonly exports: ManifestList;
  readonly routes: ManifestList;
};
