import { manifest } from "@keel/router";
import MembersShell from "./MembersShell.tsx";
import ProfilePage from "./ProfilePage.tsx";
import SigninPage from "./SigninPage.tsx";
import SignupPage from "./SignupPage.tsx";
import { deleteToken } from "./deleteToken.server.ts";
import { getTokens } from "./getTokens.server.ts";
import { loadProfile } from "./loadProfile.server.ts";
import { loadShell } from "./loadShell.server.ts";
import { loadSignin } from "./loadSignin.server.ts";
import { loadSignup } from "./loadSignup.server.ts";
import { member } from "./member.guard.ts";
import { members } from "./members.contract.ts";
import { postToken } from "./postToken.server.ts";
import { saveProfile } from "./saveProfile.server.ts";
import { signedIn } from "./signedIn.guard.ts";

export const routes = manifest(members, {
  "members.shell": { component: MembersShell, loader: loadShell },
  "members.signin": {
    component: SigninPage,
    loader: loadSignin,
    layout: "members.shell",
    title: (p) => p.data.text.signinHeading,
  },
  "members.signup": {
    component: SignupPage,
    loader: loadSignup,
    layout: "members.shell",
    title: (p) => p.data.text.signupHeading,
  },
  "members.profile": {
    component: ProfilePage,
    loader: loadProfile,
    layout: "members.shell",
    guard: signedIn,
    POST: saveProfile,
    title: (p) => p.data.text.heading,
  },
  "members.tokens": { loader: getTokens, guard: member },
  "members.mint": { action: postToken, guard: member },
  "members.revoke": { action: deleteToken, guard: member },
});
