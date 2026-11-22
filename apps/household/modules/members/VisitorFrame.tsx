import { type Infer, s } from "@keel/schema";
import { Box, Link } from "@keel/ui";
import Masthead from "./Masthead.tsx";
import { ShellData } from "./ShellData.schema.ts";
import { members } from "./members.contract.ts";

export const Props = s.object({ data: ShellData });

/** Layout `members.frame`: the masthead around the sign-in and sign-up pages, with no member navigation. */
export default function VisitorFrame(props: Infer<typeof Props> & { readonly children: () => Node }) {
  return (
    <Masthead
      data={props.data}
      nav={() => (
        <Box direction="row" align="center" gap="4">
          <Link id="members.nav.signIn" to={members.href("members.signin")} fg="text">
            {props.data.text.signIn}
          </Link>
          <Link id="members.nav.signUp" to={members.href("members.signup")} fg="text">
            {props.data.text.signUp}
          </Link>
        </Box>
      )}
    >
      {props.children()}
    </Masthead>
  );
}
