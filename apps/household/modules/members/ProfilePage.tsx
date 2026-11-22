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
      <Heading id="members.profile.heading" level={1} m="0" fontSize={{ base: "xl", md: "2xl" }} weight="semibold">
        {props.data.text.heading}
      </Heading>
      <Text id="members.signedIn" fg="textSecondary">{`${props.data.text.signedInAs} ${props.data.email}`}</Text>
      <If when={props.search.saved === true}>
        <Text id="members.saved" fg="verified" border="verified" bg="card" px="3" py="2" font="mono" fontSize="sm">
          {props.data.text.saved}
        </Text>
      </If>
      <Form method="POST" action={members.href("members.profile")} form={f}>
        <Box direction="column" gap="3" p={{ base: "3", md: "4" }} bg="card" border="hairline">
          <Input
            w="full"
            my="1"
            px="2"
            py="2"
            bg="card"
            fg="text"
            border="control"
            radius="none"
            font="serif"
            fontSize="md"
            states={{ hover: { border: "rule" }, focusVisible: { border: "rule" } }}
            field={f.field("name")}
            label={props.data.text.nameLabel}
            autocomplete="name"
          />
          <Input
            w="full"
            my="1"
            px="2"
            py="2"
            bg="card"
            fg="text"
            border="control"
            radius="none"
            font="serif"
            fontSize="md"
            states={{ hover: { border: "rule" }, focusVisible: { border: "rule" } }}
            field={f.field("phone")}
            type="tel"
            label={props.data.text.phoneLabel}
            autocomplete="tel"
          />
          <Box direction="row">
            <Button
              id="members.save"
              type="submit"
              font="mono"
              fontSize="sm"
              weight="medium"
              px="4"
              py="2"
              bg="text"
              fg="card"
              border="rule"
              radius="none"
              states={{
                hover: { bg: "textSecondary", border: "control" },
                focusVisible: { bg: "textSecondary", border: "control" },
              }}
            >
              {props.data.text.save}
            </Button>
          </Box>
        </Box>
      </Form>
      <TokenPanel text={props.data.text} tokens={props.data.tokens} />
    </Box>
  );
}
