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
    <Box as="main" id="members.signin" p="4" gap="3">
      <Heading id="members.signin.heading" level={1}>
        {props.data.text.signinHeading}
      </Heading>
      <If when={props.search.error !== undefined}>
        {() => (
          <Text id="members.signinError" fg="error">
            {props.search.error === "credentials" ? props.data.text.errorCredentials : props.data.text.errorInvalid}
          </Text>
        )}
      </If>
      <Form method="POST" action={mount.href("/sign-in/email", nextOf(props.search))} form={f}>
        <Box gap="2">
          <Input field={f.field("email")} label={props.data.text.emailLabel} autocomplete="email" />
          <Input
            field={f.field("password")}
            type="password"
            label={props.data.text.passwordLabel}
            autocomplete="current-password"
          />
          <Button id="members.signinSubmit" type="submit">
            {props.data.text.signinSubmit}
          </Button>
        </Box>
      </Form>
      <Link id="members.toSignup" to={members.href("members.signup", {}, nextOf(props.search))}>
        {props.data.text.toSignup}
      </Link>
    </Box>
  );
}
