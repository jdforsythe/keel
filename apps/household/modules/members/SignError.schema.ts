import { s } from "@keel/schema";

/**
 * Why the sign-in library refused a form post: `credentials` a wrong email or password, `invalid` any other refusal.
 * It names no typed value.
 */
export const SignError = s.enum(["credentials", "invalid"]);

export type SignError = s.infer<typeof SignError>;
