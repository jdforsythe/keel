import { AccountsText } from "../AccountsText.schema.ts";

export default AccountsText.text({
  signinTitle: "Anmelden · Keel",
  signinHeading: "Anmelden",
  signupTitle: "Konto anlegen · Keel",
  signupHeading: "Konto anlegen",
  nameLabel: "Name",
  emailLabel: "E-Mail",
  passwordLabel: "Passwort",
  signinSubmit: "Anmelden",
  signupSubmit: "Konto anlegen",
  signedInAs: { text: "Angemeldet als {email}" },
  signOut: "Abmelden",
  toSignup: "Konto anlegen",
  toSignin: "Stattdessen anmelden",
  errorCredentials: "E-Mail oder Passwort falsch",
  errorInvalid: "Angaben prüfen und erneut versuchen",
});
