import { s } from "@keel/schema";

/** What the app keeps of a signed-in user: the id the sign-in library gave it and its email, both personal data. */
export const Profile = s.object({
  userId: s.string({ min: 1, max: 256 }).pii("identifier"),
  email: s.string({ min: 3, max: 254 }).pii("contact"),
});

export type Profile = s.infer<typeof Profile>;
