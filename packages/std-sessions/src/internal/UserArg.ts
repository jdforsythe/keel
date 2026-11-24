import { s } from "@keel/schema";

/**
 * The value of `--user` (std.sessions Commands): a user id, never empty and never starting with `-` (a `-x` after
 * `--user` is a mistyped flag, so it fails as a bad value, E1052).
 */
export const UserArg = s.format("sessions.UserArg", s.string(), {
  check: (v) => v !== "" && !v.startsWith("-"),
  gen: { from: s.string(), map: (v) => `u${v.replace(/^-+/, "")}` },
});
