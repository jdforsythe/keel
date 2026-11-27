import { s } from "@keel/schema";

/** `accounts.authUnavailable`: the sign-in library's database could not be made or opened; `reason` is the system's error code. */
export const AuthUnavailable = s.error("accounts.authUnavailable", s.object({ reason: s.string() }));
