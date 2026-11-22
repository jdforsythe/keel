import { s } from "@keel/schema";

/** A greeting for the user the request came from. */
export const Greeting = s.object({ text: s.string() });
