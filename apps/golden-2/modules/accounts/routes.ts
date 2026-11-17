import { manifest } from "@keel/router";
import SigninPage from "./SigninPage.tsx";
import SignupPage from "./SignupPage.tsx";
import { loadAccount } from "./loadAccount.server.ts";
import { loadMe } from "./loadMe.server.ts";
import { postToken } from "./postToken.server.ts";
import { submitSignIn } from "./submitSignIn.server.ts";
import { submitSignUp } from "./submitSignUp.server.ts";

export const routes = manifest({
  "accounts.signup": {
    path: "/account/signup",
    loader: loadAccount,
    component: SignupPage,
    title: () => "Create an account",
  },
  "accounts.signin": {
    path: "/account/signin",
    loader: loadAccount,
    component: SigninPage,
    title: () => "Sign in",
  },
  "accounts.tokens": {
    api: true,
    path: "/api/tokens",
  },
  "accounts.me": {
    api: true,
    path: "/api/me",
    loader: loadMe,
  },
});
routes.actions({
  "accounts.signup": { POST: submitSignUp },
  "accounts.signin": { POST: submitSignIn },
  "accounts.tokens": { POST: postToken },
});
