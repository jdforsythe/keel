import { s } from "@keel/schema";

/** What the home page shows: the `api` peer's greeting, or the error code its call answered. */
export const Home = s.object({ greeting: s.string() });
