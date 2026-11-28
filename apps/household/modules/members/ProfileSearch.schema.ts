import { s } from "@keel/schema";

/** The profile page's search: `saved` after the form saved. */
export const ProfileSearch = s.object({ saved: s.boolean().optional() });
