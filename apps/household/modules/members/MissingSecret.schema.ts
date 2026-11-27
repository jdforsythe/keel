import { s } from "@keel/schema";

/** `members.secret`: the sign-in library's secret is not set, or is under 32 characters. */
export const MissingSecret = s.error("members.secret", s.object({}));
