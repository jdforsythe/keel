import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Input } from "@keel/ui";
import mount from "../../identity.ts";
import { SigninName } from "./SigninName.schema.ts";
import { SigninSearch } from "./SigninSearch.schema.ts";

export const Props = s.object({ search: SigninSearch });

/** Route `notes.signin`: a name, posted to the identity mount, which answers 303 to the page the guard named. */
export default function SigninPage(props: Infer<typeof Props>) {
  const f = form(SigninName, { id: "notes.signinForm" });
  return (
    <Box as="main" id="notes.signin" direction="column" gap="2" p="4">
      <Heading id="notes.signin.title" level={1}>
        Sign in
      </Heading>
      <Form method="POST" action={mount.href("/sign-in/email", { next: props.search.next ?? "/" })} form={f}>
        <Input field={f.field("name")} label="Name" autocomplete="name" />
        <Button id="notes.signinSubmit" type="submit">
          Sign in
        </Button>
      </Form>
    </Box>
  );
}
