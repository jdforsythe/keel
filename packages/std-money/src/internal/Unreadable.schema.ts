import { s } from "@keel/schema";

/** `money.unreadable` (std.money): text not of the form `parseMoney` reads. */
export const Unreadable = s.error("money.unreadable", s.object({}));
