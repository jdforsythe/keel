import { s } from "@keel/schema";

/** The sign-up form: the member's name, an email and a new password, at the sign-in library's lengths. */
export const Registration = s.object({
  name: s.string({ min: 1, max: 100 }).pii("name"),
  email: s.string({ min: 3, max: 254 }).pii("contact"),
  password: s.secret(s.string({ min: 8, max: 128 })),
});

export type Registration = s.infer<typeof Registration>;
