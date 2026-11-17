import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { If } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Input, Text } from "@keel/ui";
import { Credentials } from "./Credentials.schema.ts";
import { SignedIn } from "./SignedIn.schema.ts";
import { routes } from "./routes.ts";

export const Props = s.object({ data: SignedIn });

/** Route `accounts.signin`: an email and a password; once signed in, the page names the account. */
export default function SigninPage(props: Infer<typeof Props>) {
  const f = form(Credentials, { id: "accounts.signinForm" });
  return (
    <Box as="section" id="accounts.signin" direction="column" gap="4">
      <Heading id="accounts.signin.heading" level={1} fontSize="2xl" weight="semibold" m="0">
        Sign in
      </Heading>
      <If when={props.data.email !== undefined}>
        {() => <Text id="accounts.signedIn">Signed in as {props.data.email ?? ""}</Text>}
      </If>
      <Form
        method="POST"
        action={routes.href("accounts.signin")}
        form={f}
        error={(e) => (
          <Text id="accounts.signinError" fg="error">
            {e.message}
          </Text>
        )}
      >
        <Input field={f.field("email")} label="Email" autocomplete="email" />
        <Input field={f.field("password")} type="password" label="Password" autocomplete="current-password" />
        <Button id="accounts.signinSubmit" type="submit">
          Sign in
        </Button>
      </Form>
    </Box>
  );
}
