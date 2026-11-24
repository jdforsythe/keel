import { formatLiteral } from "@keel/schema";
import { TimeZone } from "./TimeZone.ts";

/** The `UTC` time zone (std.temporal). */
export const UTC: TimeZone = formatLiteral(TimeZone, "UTC");
