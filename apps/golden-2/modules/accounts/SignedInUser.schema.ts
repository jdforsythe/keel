import { s } from "@keel/schema";

/** The sign-in library's answer to a sign-in, as far as the app reads it: the user's id and email. */
export const SignedInUser = s.object({
  user: s.object({
    id: s.string({ min: 1, max: 256 }).pii("identifier"),
    email: s.string({ min: 3, max: 254 }).pii("contact"),
  }),
});

export type SignedInUser = s.infer<typeof SignedInUser>;
