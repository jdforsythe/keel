import { s } from "@keel/schema";
import { Hashed } from "@keel/std-credentials";

/** The `accounts.setPassword` payload: an account and its new hash. */
export const PasswordChange = s.object({ userId: s.id("User"), password: Hashed });

export type PasswordChange = s.infer<typeof PasswordChange>;
