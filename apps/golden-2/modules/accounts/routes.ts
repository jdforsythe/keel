import { manifest } from "@keel/router";
import SigninPage from "./SigninPage.tsx";
import SignupPage from "./SignupPage.tsx";
import { accounts } from "./accounts.contract.ts";
import { loadMe } from "./loadMe.server.ts";
import { loadSignin } from "./loadSignin.server.ts";
import { loadSignup } from "./loadSignup.server.ts";
import { postToken } from "./postToken.server.ts";

export const routes = manifest(accounts, {
  "accounts.signup": { loader: loadSignup, component: SignupPage, title: (p) => p.data.text.signupTitle },
  "accounts.signin": { loader: loadSignin, component: SigninPage, title: (p) => p.data.text.signinTitle },
  "accounts.mint": { action: postToken },
  "accounts.me": { loader: loadMe },
});
