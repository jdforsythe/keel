import type { DocsRow } from "./DocsRow.ts";

/** One area of the docs (k.docs Areas): its id, its title and its sections in order. */
export type DocsArea = { readonly id: string; readonly title: string; readonly sections: readonly DocsRow[] };
