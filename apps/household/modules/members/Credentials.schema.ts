import { s } from "@keel/schema";

/** The sign-in form: an email and a password, the password a secret from the moment it is parsed. */
export const Credentials = s.object({
  email: s.string({ min: 3, max: 254 }).pii("contact"),
  password: s.secret(s.string({ min: 8, max: 128 })),
});

export type Credentials = s.infer<typeof Credentials>;
