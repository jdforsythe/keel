import { AccountsText } from "../AccountsText.schema.ts";

export default AccountsText.text({
  signinTitle: "Sign in · Keel",
  signinHeading: "Sign in",
  signupTitle: "Create an account · Keel",
  signupHeading: "Create an account",
  nameLabel: "Name",
  emailLabel: "Email",
  passwordLabel: "Password",
  signinSubmit: "Sign in",
  signupSubmit: "Create account",
  signedInAs: { text: "Signed in as {email}" },
  signOut: "Sign out",
  toSignup: "Create an account",
  toSignin: "Sign in instead",
  errorCredentials: "Wrong email or password",
  errorInvalid: "Check the details and try again",
});
