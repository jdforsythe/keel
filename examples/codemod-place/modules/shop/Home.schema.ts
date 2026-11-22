import { s } from "@keel/schema";

/** What the home page shows: the shelf count for one item, or the error code the call answered. */
export const Home = s.object({ shelf: s.string() });
