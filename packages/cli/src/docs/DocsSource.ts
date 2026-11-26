import type { DocsRow } from "./DocsRow.ts";

/** A readable section for `--for <block>` and `--for <name>`: its row and its text. */
export type DocsSource = { readonly row: DocsRow; readonly text: string };
