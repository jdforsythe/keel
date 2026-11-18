import { s } from "@keel/schema";

/**
 * Why the sign-in library refused a form post: `credentials` a wrong email or password, `invalid` any other refusal.
 * It names no typed value. A sign-up with an email that already has an account is answered as a success by the
 * library, so the page cannot tell whether an email is known.
 */
export const AccountError = s.enum(["credentials", "invalid"]);

export type AccountError = s.infer<typeof AccountError>;
