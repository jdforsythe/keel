import { s } from "@keel/schema";

/**
 * The sign-in form: an email and a password, the password a secret from the moment it is parsed. The lengths are the
 * sign-in library's (8 to 128 characters), so the page refuses on the client what the library would refuse.
 */
export const Credentials = s.object({
  email: s.string({ min: 3, max: 254 }).pii("contact"),
  password: s.secret(s.string({ min: 8, max: 128 })),
});

export type Credentials = s.infer<typeof Credentials>;
