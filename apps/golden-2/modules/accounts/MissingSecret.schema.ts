import { s } from "@keel/schema";

/** `accounts.secret`: the sign-in library's secret is not set, or is under 32 characters. */
export const MissingSecret = s.error("accounts.secret", s.object({}));
