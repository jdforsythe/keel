import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { If } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Input, Text } from "@keel/ui";
import mount from "../../identity.ts";
import { Profile } from "./Profile.schema.ts";
import { ProfileData } from "./ProfileData.schema.ts";
import { ProfileSearch } from "./ProfileSearch.schema.ts";
import TokenPanel from "./TokenPanel.tsx";
import { members } from "./members.contract.ts";

export const Props = s.object({ search: ProfileSearch, data: ProfileData });

/** Route `members.profile`: the member's name and phone, a sign-out button, and their API tokens. */
export default function ProfilePage(props: Infer<typeof Props>) {
  const f = form(Profile, {
    id: "members.profileForm",
    initial: { name: props.data.name, ...(props.data.phone === undefined ? {} : { phone: props.data.phone }) },
  });
  return (
    <Box as="main" id="members.profile" p="4" gap="3">
      <Heading id="members.profile.heading" level={1}>
        {props.data.text.heading}
      </Heading>
      <Text id="members.signedIn">{`${props.data.text.signedInAs} ${props.data.email}`}</Text>
      <If when={props.search.saved === true}>
        <Text id="members.saved">{props.data.text.saved}</Text>
      </If>
      <Form method="POST" action={members.href("members.profile")} form={f}>
        <Box gap="2">
          <Input field={f.field("name")} label={props.data.text.nameLabel} autocomplete="name" />
          <Input field={f.field("phone")} type="tel" label={props.data.text.phoneLabel} autocomplete="tel" />
          <Button id="members.save" type="submit">
            {props.data.text.save}
          </Button>
        </Box>
      </Form>
      <Form method="POST" action={mount.href("/sign-out")}>
        <Button id="members.signOut" type="submit">
          {props.data.text.signOut}
        </Button>
      </Form>
      <TokenPanel text={props.data.text} tokens={props.data.tokens} />
    </Box>
  );
}
