import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { If } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Input, Text } from "@keel/ui";
import { Profile } from "./Profile.schema.ts";
import { ProfileData } from "./ProfileData.schema.ts";
import { ProfileSearch } from "./ProfileSearch.schema.ts";
import TokenPanel from "./TokenPanel.tsx";
import { members } from "./members.contract.ts";

export const Props = s.object({ search: ProfileSearch, data: ProfileData });

/** Route `members.profile`: the member's name and phone, and their API tokens; the frame holds sign-out. */
export default function ProfilePage(props: Infer<typeof Props>) {
  const f = form(Profile, {
    id: "members.profileForm",
    initial: { name: props.data.name, ...(props.data.phone === undefined ? {} : { phone: props.data.phone }) },
  });
  return (
    <Box as="section" id="members.profile" direction="column" gap="4">
      <Heading id="members.profile.heading" level={1} fontSize={{ base: "xl", md: "2xl" }}>
        {props.data.text.heading}
      </Heading>
      <Text id="members.signedIn" fg="textSecondary">{`${props.data.text.signedInAs} ${props.data.email}`}</Text>
      <If when={props.search.saved === true}>
        <Text id="members.saved" look="notice" fg="verified" border="verified">
          {props.data.text.saved}
        </Text>
      </If>
      <Form method="POST" action={members.href("members.profile")} form={f}>
        <Box look="panel">
          <Input field={f.field("name")} label={props.data.text.nameLabel} autocomplete="name" />
          <Input field={f.field("phone")} type="tel" label={props.data.text.phoneLabel} autocomplete="tel" />
          <Box direction="row">
            <Button id="members.save" type="submit">
              {props.data.text.save}
            </Button>
          </Box>
        </Box>
      </Form>
      <TokenPanel text={props.data.text} tokens={props.data.tokens} />
    </Box>
  );
}
