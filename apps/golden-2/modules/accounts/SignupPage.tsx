import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { If } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Input, Link, Text } from "@keel/ui";
import mount from "../../identity.ts";
import { AccountData } from "./AccountData.schema.ts";
import { AccountsParams } from "./AccountsParams.schema.ts";
import { AccountsSearch } from "./AccountsSearch.schema.ts";
import { Registration } from "./Registration.schema.ts";
import { routes } from "./routes.ts";

export const Props = s.object({ params: AccountsParams, search: AccountsSearch, data: AccountData });

/**
 * Route `accounts.signup`: a name, an email and a new password, posted by the browser to the sign-in library once
 * they validate. Success goes to the sign-in page; a refusal comes back as `?error=` and shows above the form.
 */
export default function SignupPage(props: Infer<typeof Props>) {
  const f = form(Registration, { id: "accounts.signupForm" });
  return (
    <Box as="section" id="accounts.signup" direction="column" gap="4">
      <Heading id="accounts.signup.heading" level={1} fontSize="2xl" weight="semibold" m="0">
        {props.data.text.signupHeading}
      </Heading>
      <If when={props.search.error !== undefined}>
        {() => (
          <Text id="accounts.signupError" fg="error">
            {props.data.text.errorInvalid}
          </Text>
        )}
      </If>
      <Form method="POST" action={mount.href("/sign-up/email", { locale: props.params.locale })} form={f}>
        <Input field={f.field("name")} label={props.data.text.nameLabel} autocomplete="name" />
        <Input field={f.field("email")} label={props.data.text.emailLabel} autocomplete="email" />
        <Input
          field={f.field("password")}
          type="password"
          label={props.data.text.passwordLabel}
          autocomplete="new-password"
        />
        <Button id="accounts.signupSubmit" type="submit">
          {props.data.text.signupSubmit}
        </Button>
      </Form>
      <Link id="accounts.toSignin" to={routes.href("accounts.signin", { locale: props.params.locale })}>
        {props.data.text.toSignin}
      </Link>
    </Box>
  );
}
