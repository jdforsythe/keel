import { s } from "@keel/schema";

/** A debounced run was dropped before its time came (std.tables). */
export const Cancelled = s.error("tables.cancelled", s.object({}));
