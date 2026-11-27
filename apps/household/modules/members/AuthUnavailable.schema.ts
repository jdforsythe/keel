import { s } from "@keel/schema";

/** `members.authUnavailable`: the sign-in library's database could not be made or opened; `reason` is the system's error code. */
export const AuthUnavailable = s.error("members.authUnavailable", s.object({ reason: s.string() }));
