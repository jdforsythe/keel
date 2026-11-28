import { s } from "@keel/schema";

/** The host's `Intl` does not know a time zone. */
export const UnknownZone = s.error("schedules.unknownZone", s.object({}));
