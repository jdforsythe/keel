import { s } from "@keel/schema";

/** What one staple's step did: `putBack` is false when the staple was already on the list to buy, or the list was full. */
export const PutBack = s.object({ putBack: s.boolean() });
