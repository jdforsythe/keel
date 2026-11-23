import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { If } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { formatMessage } from "@keel/std-messages";
import { Box, Button, Heading, Image, Input, Link, Text } from "@keel/ui";
import mount from "../../identity.ts";
import { AccountData } from "./AccountData.schema.ts";
import { AccountsParams } from "./AccountsParams.schema.ts";
import { AccountsSearch } from "./AccountsSearch.schema.ts";
import { Credentials } from "./Credentials.schema.ts";
import { accounts } from "./accounts.contract.ts";

export const Props = s.object({ params: AccountsParams, search: AccountsSearch, data: AccountData });

/**
 * Route `accounts.signin`: an email and a password, posted by the browser to the sign-in library once they
 * validate; a refusal comes back as `?error=` and shows above the form. Signed in, the page first names the account
 * and offers a sign-out form; the sign-in form stays, to sign in as someone else.
 */
export default function SigninPage(props: Infer<typeof Props>) {
  const f = form(Credentials, { id: "accounts.signinForm" });
  return (
    <Box
      as="main"
      id="accounts.signin"
      direction="column"
      gap="5"
      w={{ md: "measure" }}
      mx={{ md: "auto" }}
      px={{ base: "3", md: "4" }}
      py={{ base: "5", md: "7" }}
    >
      <Image src="/keel-mark.svg" decorative h="mark" w="mark" />
      <Heading id="accounts.signin.heading" level={1} fontSize={{ base: "xl", md: "2xl" }} m="0">
        {props.data.text.signinHeading}
      </Heading>
      <Box h="hairline" bg="divider" />
      <If when={props.data.email !== undefined}>
        {() => (
          <Box direction="column" align="start" gap="3">
            <Text id="accounts.signedIn">
              {formatMessage(props.data.text.signedInAs, { email: props.data.email ?? "" }, props.params.locale)}
            </Text>
            <Form method="POST" action={mount.href("/sign-out", { locale: props.params.locale })}>
              <Button id="accounts.signOut" type="submit" look="secondary">
                {props.data.text.signOut}
              </Button>
            </Form>
          </Box>
        )}
      </If>
      <If when={props.search.error !== undefined}>
        {() => (
          <Text id="accounts.signinError" fg="error" bg="card" border="error" px="3" py="2" font="mono" fontSize="sm">
            {props.search.error === "credentials" ? props.data.text.errorCredentials : props.data.text.errorInvalid}
          </Text>
        )}
      </If>
      <Form method="POST" action={mount.href("/sign-in/email", { locale: props.params.locale })} form={f}>
        <Box direction="column" gap="4">
          <Input
            field={f.field("email")}
            label={props.data.text.emailLabel}
            autocomplete="email"
            styles={{ field: { direction: "column", gap: "1" } }}
          />
          <Input
            field={f.field("password")}
            type="password"
            label={props.data.text.passwordLabel}
            autocomplete="current-password"
            styles={{ field: { direction: "column", gap: "1" } }}
          />
          <Box direction="row">
            <Button id="accounts.signinSubmit" type="submit">
              {props.data.text.signinSubmit}
            </Button>
          </Box>
        </Box>
      </Form>
      <Link
        id="accounts.toSignup"
        to={accounts.href("accounts.signup", { locale: props.params.locale })}
        font="mono"
        fontSize="sm"
      >
        {props.data.text.toSignup}
      </Link>
    </Box>
  );
}
