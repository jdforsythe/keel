import { s } from "@keel/schema";

export const Home = s.object({ heading: s.string(), quote: s.string(), author: s.string() });
