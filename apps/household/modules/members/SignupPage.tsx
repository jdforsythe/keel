import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { If } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Input, Link, Text } from "@keel/ui";
import mount from "../../identity.ts";
import { Registration } from "./Registration.schema.ts";
import { SignData } from "./SignData.schema.ts";
import { SignSearch } from "./SignSearch.schema.ts";
import { members } from "./members.contract.ts";
import { nextOf } from "./nextOf.ts";

export const Props = s.object({ search: SignSearch, data: SignData });

/**
 * Route `members.signup`: a name, an email and a new password, posted by the browser to the sign-in library once they
 * validate. A new account goes on to the sign-in page; a refusal comes back as `?error=`.
 */
export default function SignupPage(props: Infer<typeof Props>) {
  const f = form(Registration, { id: "members.signupForm" });
  return (
    <Box as="section" id="members.signup" direction="column" gap="4">
      <Heading id="members.signup.heading" level={1} fontSize={{ base: "xl", md: "2xl" }}>
        {props.data.text.signupHeading}
      </Heading>
      <If when={props.search.error !== undefined}>
        {() => (
          <Text id="members.signupError" look="notice" fg="error" border="error">
            {props.data.text.errorInvalid}
          </Text>
        )}
      </If>
      <Form method="POST" action={mount.href("/sign-up/email", nextOf(props.search))} form={f}>
        <Box look="panel">
          <Input field={f.field("name")} label={props.data.text.nameLabel} autocomplete="name" />
          <Input field={f.field("email")} label={props.data.text.emailLabel} autocomplete="email" />
          <Input
            field={f.field("password")}
            type="password"
            label={props.data.text.passwordLabel}
            autocomplete="new-password"
          />
          <Box direction="row">
            <Button id="members.signupSubmit" type="submit">
              {props.data.text.signupSubmit}
            </Button>
          </Box>
        </Box>
      </Form>
      <Link id="members.toSignin" to={members.href("members.signin", {}, nextOf(props.search))}>
        {props.data.text.toSignin}
      </Link>
    </Box>
  );
}
