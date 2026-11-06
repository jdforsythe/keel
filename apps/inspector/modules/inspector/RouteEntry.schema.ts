import { s } from "@keel/schema";

/** One `routes.json` entry (k.compiler), the fields the inspector shows; a layout has no path. */
export const RouteEntry = s.object({ path: s.string().nullable(), module: s.string() });
