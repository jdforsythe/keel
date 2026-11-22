import { s } from "@keel/schema";

/** The sign-in form: the name the stand-in identity source signs in. */
export const SigninName = s.object({ name: s.string({ min: 1, max: 40 }).pii("name") });
