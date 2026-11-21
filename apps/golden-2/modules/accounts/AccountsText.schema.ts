import { s } from "@keel/schema";
import { messages } from "@keel/std-messages";
import { AccountsLocale } from "./AccountsLocale.schema.ts";

/** Every string the account pages show, one file per locale in `AccountsText/`. */
export const AccountsText = messages(
  AccountsLocale,
  {
    signinTitle: {},
    signinHeading: {},
    signupTitle: {},
    signupHeading: {},
    nameLabel: {},
    emailLabel: {},
    passwordLabel: {},
    signinSubmit: {},
    signupSubmit: {},
    signedInAs: { email: s.string() },
    signOut: {},
    toSignup: {},
    toSignin: {},
    errorCredentials: {},
    errorInvalid: {},
  },
  (locale) => import(`./AccountsText/${locale}.ts`),
);

export type AccountsText = s.infer<typeof AccountsText>;
