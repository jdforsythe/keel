import { s } from "@keel/schema";

/** `accounts.authUnavailable`: the sign-in library's database could not be made or opened; `reason` is `sqlite` for the library and `file` for the file system. */
export const AuthUnavailable = s.error("accounts.authUnavailable", s.object({ reason: s.enum(["sqlite", "file"]) }));
