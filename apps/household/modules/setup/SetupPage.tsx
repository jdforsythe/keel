import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { If } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Input, Text } from "@keel/ui";
import { SetupData } from "./SetupData.schema.ts";
import { SetupForm } from "./SetupForm.schema.ts";
import { SetupSearch } from "./SetupSearch.schema.ts";
import { setup } from "./setup.contract.ts";

export const Props = s.object({ search: SetupSearch, data: SetupData });

export default function SetupPage(props: Infer<typeof Props>) {
  const f = form(SetupForm, { id: "setup.form" });
  return (
    <Box as="section" id="setup.page" direction="column" gap="4">
      <Heading id="setup.heading" level={1} m="0" fontSize={{ base: "xl", md: "2xl" }} weight="semibold">
        {props.data.heading}
      </Heading>
      <Text id="setup.intro" fg="textSecondary">
        {props.data.intro}
      </Text>
      <If when={props.data.current !== null}>
        <Text id="setup.done" fg="verified" border="verified" bg="card" px="3" py="2" font="mono" fontSize="sm">
          {props.data.done}
        </Text>
      </If>
      <Form method="POST" action={setup.href("setup.form", {}, props.search)} form={f}>
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
            label={props.data.name}
            autocomplete="off"
          />
          <Box direction="row">
            <Button
              id="setup.save"
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
              {props.data.save}
            </Button>
          </Box>
        </Box>
      </Form>
    </Box>
  );
}
