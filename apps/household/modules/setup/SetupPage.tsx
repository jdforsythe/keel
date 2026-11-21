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
    <Box as="main" id="setup.page" p="4" gap="3">
      <Heading id="setup.heading" level={1}>
        {props.data.heading}
      </Heading>
      <Text id="setup.intro">{props.data.intro}</Text>
      <If when={props.data.current !== null}>
        <Text id="setup.done">{props.data.done}</Text>
      </If>
      <Form method="POST" action={setup.href("setup.form", {}, props.search)} form={f}>
        <Box gap="2">
          <Input field={f.field("name")} label={props.data.name} autocomplete="off" />
          <Button id="setup.save" type="submit">
            {props.data.save}
          </Button>
        </Box>
      </Form>
    </Box>
  );
}
