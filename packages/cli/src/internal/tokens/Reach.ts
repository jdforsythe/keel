import type { DesignFile } from "./DesignFile.ts";

/** Where a conversion looks: all the files, and the index of the one it is in. */
export type Reach = { readonly files: readonly DesignFile[]; readonly file: number };
