import { TimeZone } from "./TimeZone.ts";

const utc = TimeZone.parse("UTC");
if (!utc.ok) throw new Error("std.temporal: this runtime does not know the UTC time zone");

/** The `UTC` time zone (std.temporal). */
export const UTC: TimeZone = utc.value;
