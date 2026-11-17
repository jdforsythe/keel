import { s } from "@keel/schema";
import { Hashed } from "@keel/std-credentials";

/** An account: its email and the hash of its password, never the password text. */
export const User = s.object({
  id: s.id("User"),
  email: s.string({ min: 3, max: 254 }).pii("contact"),
  password: Hashed,
});

export type User = s.infer<typeof User>;
