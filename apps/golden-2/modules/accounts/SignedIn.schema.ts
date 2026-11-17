import { s } from "@keel/schema";

/** What the account pages show: the email the caller is signed in as, when it is. */
export const SignedIn = s.object({ email: s.string().pii("contact").optional() });

export type SignedIn = s.infer<typeof SignedIn>;
