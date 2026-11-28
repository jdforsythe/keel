import { s } from "@keel/schema";

/** `geo.unavailable` (std.geo): no position could be read. */
export const Unavailable = s.error("geo.unavailable", s.object({}));
