import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Input, Text } from "@keel/ui";
import { Credentials } from "./Credentials.schema.ts";
import { SignedIn } from "./SignedIn.schema.ts";
import { routes } from "./routes.ts";

export const Props = s.object({ data: SignedIn });

/** Route `accounts.signup`: an email and a new password; success goes to the sign-in page. */
export default function SignupPage(_props: Infer<typeof Props>) {
  const f = form(Credentials, { id: "accounts.signupForm" });
  return (
    <Box as="section" id="accounts.signup" direction="column" gap="4">
      <Heading id="accounts.signup.heading" level={1} fontSize="2xl" weight="semibold" m="0">
        Create an account
      </Heading>
      <Form
        method="POST"
        action={routes.href("accounts.signup")}
        form={f}
        error={(e) => <Text fg="error">{e.message}</Text>}
      >
        <Input field={f.field("email")} label="Email" autocomplete="email" />
        <Input field={f.field("password")} type="password" label="Password" autocomplete="new-password" />
        <Button id="accounts.signupSubmit" type="submit">
          Create account
        </Button>
      </Form>
    </Box>
  );
}
