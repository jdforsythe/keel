import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { If } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Input, Link, Text } from "@keel/ui";
import mount from "../../identity.ts";
import { Credentials } from "./Credentials.schema.ts";
import { SignData } from "./SignData.schema.ts";
import { SignSearch } from "./SignSearch.schema.ts";
import { members } from "./members.contract.ts";
import { nextOf } from "./nextOf.ts";

export const Props = s.object({ search: SignSearch, data: SignData });

/**
 * Route `members.signin`: an email and a password, posted by the browser to the sign-in library once they validate.
 * A sign-in goes on to the page the guard sent the member from; a refusal comes back as `?error=`.
 */
export default function SigninPage(props: Infer<typeof Props>) {
  const f = form(Credentials, { id: "members.signinForm" });
  return (
    <Box as="section" id="members.signin" direction="column" gap="4">
      <Heading id="members.signin.heading" level={1} m="0" fontSize={{ base: "xl", md: "2xl" }} weight="semibold">
        {props.data.text.signinHeading}
      </Heading>
      <If when={props.search.error !== undefined}>
        {() => (
          <Text id="members.signinError" fg="error" bg="card" border="error" px="3" py="2" font="mono" fontSize="sm">
            {props.search.error === "credentials" ? props.data.text.errorCredentials : props.data.text.errorInvalid}
          </Text>
        )}
      </If>
      <Form method="POST" action={mount.href("/sign-in/email", nextOf(props.search))} form={f}>
        <Box direction="column" gap="3" p={{ base: "3", md: "4" }} bg="card" border="hairline">
          <Input
            w="full"
            my="1"
            px="2"
            py="2"
            bg="card"
            fg="text"
            border="control"
            radius="none"
            font="serif"
            fontSize="md"
            states={{ hover: { border: "rule" }, focusVisible: { border: "rule" } }}
            field={f.field("email")}
            label={props.data.text.emailLabel}
            autocomplete="email"
          />
          <Input
            w="full"
            my="1"
            px="2"
            py="2"
            bg="card"
            fg="text"
            border="control"
            radius="none"
            font="serif"
            fontSize="md"
            states={{ hover: { border: "rule" }, focusVisible: { border: "rule" } }}
            field={f.field("password")}
            type="password"
            label={props.data.text.passwordLabel}
            autocomplete="current-password"
          />
          <Box direction="row">
            <Button
              id="members.signinSubmit"
              type="submit"
              font="mono"
              fontSize="sm"
              weight="medium"
              px="4"
              py="2"
              bg="text"
              fg="card"
              border="rule"
              radius="none"
              states={{
                hover: { bg: "textSecondary", border: "control" },
                focusVisible: { bg: "textSecondary", border: "control" },
              }}
            >
              {props.data.text.signinSubmit}
            </Button>
          </Box>
        </Box>
      </Form>
      <Link id="members.toSignup" fg="text" to={members.href("members.signup", {}, nextOf(props.search))}>
        {props.data.text.toSignup}
      </Link>
    </Box>
  );
}
