import type { ApiEntry } from "./ApiEntry.ts";
import type { LayoutEntry } from "./LayoutEntry.ts";
import type { PageEntry } from "./PageEntry.ts";

/** One contract entry, of one kind told apart by its required members (k.contract). */
export type Entry = PageEntry | LayoutEntry | ApiEntry;
