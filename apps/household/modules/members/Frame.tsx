import { Form } from "@keel/router";
import { If } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Image, Link, Text } from "@keel/ui";
import mount from "../../identity.ts";
import { ShellData } from "./ShellData.schema.ts";
import { members } from "./members.contract.ts";

export const Props = s.object({ data: ShellData });

/**
 * The page frame every shell layout renders: a masthead with the mark, the app's name and the household's name, the
 * main navigation, a hairline, and the page in a centred column. `nav` holds the links the calling module may make
 * (its `deps`); the frame adds the profile link and the sign-out button for a member, or the sign-in and sign-up
 * links for a visitor.
 */
export default function Frame(
  props: Infer<typeof Props> & { readonly nav?: () => Node; readonly children: () => Node },
) {
  return (
    <Box id="frame" direction="column" bg="surface" fg="text" font="serif" fontSize="md">
      <Box
        as="header"
        id="frame.masthead"
        direction={{ base: "column", md: "row" }}
        align={{ base: "start", md: "center" }}
        justify="between"
        gap="3"
        px={{ base: "3", md: "6" }}
        py={{ base: "3", md: "4" }}
      >
        <Box direction="row" align="center" gap="3">
          <Image src="/keel-mark.svg" decorative h="mark" />
          <Text id="frame.app" fontSize="lg" weight="semibold">
            {props.data.text.app}
          </Text>
          <If when={props.data.name !== null}>
            {() => (
              <Text id="frame.name" font="mono" fontSize="xs" fg="textSecondary" px="2" py="1" border="hairline">
                {props.data.name ?? ""}
              </Text>
            )}
          </If>
        </Box>
        <Box as="nav" id="frame.nav" label={props.data.text.nav} direction="row" align="center" wrap="wrap" gap="4">
          {props.nav?.() ?? ""}
          <If when={props.data.signedIn}>
            {() => (
              <Box direction="row" align="center" gap="4">
                <Link id="frame.profile" to={members.href("members.profile")} fg="text">
                  {props.data.text.profile}
                </Link>
                <Form method="POST" action={mount.href("/sign-out")}>
                  <Button
                    id="frame.signOut"
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
                <Link id="frame.signIn" to={members.href("members.signin")} fg="text">
                  {props.data.text.signIn}
                </Link>
                <Link id="frame.signUp" to={members.href("members.signup")} fg="text">
                  {props.data.text.signUp}
                </Link>
              </Box>
            )}
          </If>
        </Box>
      </Box>
      <Box h="hairline" bg="divider" />
      <Box
        as="main"
        id="frame.main"
        w={{ md: "measure" }}
        mx={{ md: "auto" }}
        px={{ base: "3", md: "4" }}
        py={{ base: "4", md: "6" }}
      >
        {props.children()}
      </Box>
    </Box>
  );
}
