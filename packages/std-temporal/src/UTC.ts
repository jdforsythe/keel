import { formatLiteral } from "@keel/schema";
import { TimeZone } from "./TimeZone.schema.ts";

/** The `UTC` time zone (std.temporal). */
export const UTC: TimeZone = formatLiteral(TimeZone, "UTC");
