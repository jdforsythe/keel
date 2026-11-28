import { s } from "@keel/schema";

/** A state schema with no `.pii` node. */
export const Notes = s.object({ title: s.string() });
