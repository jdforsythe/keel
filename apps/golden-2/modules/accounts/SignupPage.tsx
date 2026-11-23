import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { If } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Image, Input, Link, Text } from "@keel/ui";
import mount from "../../identity.ts";
import { AccountData } from "./AccountData.schema.ts";
import { AccountsParams } from "./AccountsParams.schema.ts";
import { AccountsSearch } from "./AccountsSearch.schema.ts";
import { Registration } from "./Registration.schema.ts";
import { accounts } from "./accounts.contract.ts";

export const Props = s.object({ params: AccountsParams, search: AccountsSearch, data: AccountData });

/**
 * Route `accounts.signup`: a name, an email and a new password, posted by the browser to the sign-in library once
 * they validate. Success goes to the sign-in page; a refusal comes back as `?error=` and shows above the form.
 */
export default function SignupPage(props: Infer<typeof Props>) {
  const f = form(Registration, { id: "accounts.signupForm" });
  return (
    <Box
      as="main"
      id="accounts.signup"
      direction="column"
      gap="5"
      w={{ md: "measure" }}
      mx={{ md: "auto" }}
      px={{ base: "3", md: "4" }}
      py={{ base: "5", md: "7" }}
    >
      <Image src="/keel-mark.svg" decorative h="mark" w="mark" />
      <Heading id="accounts.signup.heading" level={1} fontSize={{ base: "xl", md: "2xl" }} m="0">
        {props.data.text.signupHeading}
      </Heading>
      <Box h="hairline" bg="divider" />
      <If when={props.search.error !== undefined}>
        {() => (
          <Text id="accounts.signupError" fg="error" bg="card" border="error" px="3" py="2" font="mono" fontSize="sm">
            {props.data.text.errorInvalid}
          </Text>
        )}
      </If>
      <Form method="POST" action={mount.href("/sign-up/email", { locale: props.params.locale })} form={f}>
        <Box direction="column" gap="4">
          <Input
            field={f.field("name")}
            label={props.data.text.nameLabel}
            autocomplete="name"
            styles={{ field: { direction: "column", gap: "1" } }}
          />
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
            autocomplete="new-password"
            styles={{ field: { direction: "column", gap: "1" } }}
          />
          <Box direction="row">
            <Button id="accounts.signupSubmit" type="submit">
              {props.data.text.signupSubmit}
            </Button>
          </Box>
        </Box>
      </Form>
      <Link
        id="accounts.toSignin"
        to={accounts.href("accounts.signin", { locale: props.params.locale })}
        font="mono"
        fontSize="sm"
      >
        {props.data.text.toSignin}
      </Link>
    </Box>
  );
}
