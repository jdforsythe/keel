import { manifest } from "@keel/router";
import { AccountsParams } from "./AccountsParams.schema.ts";
import { AccountsSearch } from "./AccountsSearch.schema.ts";
import SigninPage from "./SigninPage.tsx";
import SignupPage from "./SignupPage.tsx";
import { loadAccount } from "./loadAccount.server.ts";
import { loadMe } from "./loadMe.server.ts";
import { postToken } from "./postToken.server.ts";

export const routes = manifest({
  "accounts.signup": {
    path: "/:locale/account/signup",
    params: AccountsParams,
    search: AccountsSearch,
    loader: loadAccount,
    component: SignupPage,
    title: (p) => p.data.text.signupTitle,
  },
  "accounts.signin": {
    path: "/:locale/account/signin",
    params: AccountsParams,
    search: AccountsSearch,
    loader: loadAccount,
    component: SigninPage,
    title: (p) => p.data.text.signinTitle,
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
routes.actions({ "accounts.tokens": { POST: postToken } });
