import { s } from "@keel/schema";

/** The copy of the sign-in and sign-up pages. */
export const SignText = s.object({
  signinHeading: s.string(),
  signupHeading: s.string(),
  nameLabel: s.string(),
  emailLabel: s.string(),
  passwordLabel: s.string(),
  signinSubmit: s.string(),
  signupSubmit: s.string(),
  toSignup: s.string(),
  toSignin: s.string(),
  errorCredentials: s.string(),
  errorInvalid: s.string(),
});
