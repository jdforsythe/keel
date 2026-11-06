import type { Table } from "./Table.ts";

/** The compiled table of each manifest object `manifest()` returned. */
export const tables = new WeakMap<object, Table>();
