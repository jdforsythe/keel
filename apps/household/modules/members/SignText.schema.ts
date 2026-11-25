import { s } from "@keel/schema";

/** The copy of the sign-in and sign-up pages. */
export const SignText = s.object({
  signinHeading: s.string({ min: 1 }),
  signupHeading: s.string({ min: 1 }),
  nameLabel: s.string({ min: 1 }),
  emailLabel: s.string({ min: 1 }),
  passwordLabel: s.string({ min: 1 }),
  signinSubmit: s.string({ min: 1 }),
  signupSubmit: s.string({ min: 1 }),
  toSignup: s.string({ min: 1 }),
  toSignin: s.string({ min: 1 }),
  errorCredentials: s.string({ min: 1 }),
  errorInvalid: s.string({ min: 1 }),
});
