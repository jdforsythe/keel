import { Form } from "@keel/router";
import { If } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Link } from "@keel/ui";
import mount from "../../identity.ts";
import Masthead from "../members/Masthead.tsx";
import { ShellData } from "../members/ShellData.schema.ts";
import { members } from "../members/members.contract.ts";
import { receipts } from "../receipts/receipts.contract.ts";
import { setup } from "../setup/setup.contract.ts";
import { shopping } from "../shopping/shopping.contract.ts";

export const Props = s.object({ data: ShellData });

/**
 * Layout `app.frame`: the one frame around every signed-in page of every module. `app` lists each feature module in
 * `deps`, so its masthead links to all of them: List, Receipts, Setup and Profile, then Sign out. A visitor on the
 * start page gets the sign-in and sign-up links instead.
 */
export default function AppFrame(props: Infer<typeof Props> & { readonly children: () => Node }) {
  return (
    <Masthead
      data={props.data}
      nav={() => (
        <Box direction="row" align="center" wrap="wrap" gap="4">
          <If when={props.data.signedIn}>
            {() => (
              <Box direction="row" align="center" wrap="wrap" gap="4">
                <Link id="app.nav.list" to={shopping.href("shopping.list")} fg="text">
                  {props.data.text.list}
                </Link>
                <Link id="app.nav.receipts" to={receipts.href("receipts.book", { locale: "en-US" })} fg="text">
                  {props.data.text.receipts}
                </Link>
                <Link id="app.nav.setup" to={setup.href("setup.form")} fg="text">
                  {props.data.text.setup}
                </Link>
                <Link id="app.nav.profile" to={members.href("members.profile")} fg="text">
                  {props.data.text.profile}
                </Link>
                <Form method="POST" action={mount.href("/sign-out")}>
                  <Button
                    id="app.nav.signOut"
                    type="submit"
                    font="mono"
                    fontSize="sm"
                    px="3"
                    py="1"
                    bg="card"
                    fg="text"
                    border="rule"
                    radius="none"
                    states={{ hover: { bg: "surfaceLow" }, focusVisible: { bg: "surfaceLow" } }}
                  >
                    {props.data.text.signOut}
                  </Button>
                </Form>
              </Box>
            )}
          </If>
          <If when={!props.data.signedIn}>
            {() => (
              <Box direction="row" align="center" gap="4">
                <Link id="app.nav.signIn" to={members.href("members.signin")} fg="text">
                  {props.data.text.signIn}
                </Link>
                <Link id="app.nav.signUp" to={members.href("members.signup")} fg="text">
                  {props.data.text.signUp}
                </Link>
              </Box>
            )}
          </If>
        </Box>
      )}
    >
      {props.children()}
    </Masthead>
  );
}
