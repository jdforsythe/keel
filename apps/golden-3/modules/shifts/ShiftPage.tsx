import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { If } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Input, Text, TextArea } from "@keel/ui";
import { ShiftOpen } from "./ShiftOpen.schema.ts";
import { shifts } from "./shifts.contract.ts";
import { SignupDraft } from "./SignupDraft.schema.ts";

export const Props = s.object({ data: ShiftOpen });

export default function ShiftPage(props: Infer<typeof Props>) {
  const f = form(SignupDraft, { id: "shifts.join" });
  return (
    <Box id="shifts.show" direction="column" gap="3">
      <Heading id="shifts.show.title" level={1}>
        {props.data.title}
      </Heading>
      <Text id="shifts.show.when">{props.data.when}</Text>
      <Text id="shifts.show.open">{`${props.data.open} of ${props.data.slots} places open`}</Text>
      <If when={props.data.open > 0} fallback={() => <Text id="shifts.show.full">This shift is full</Text>}>
        <Form
          method="POST"
          action={shifts.href("shifts.show", { shiftId: props.data.id })}
          form={f}
          error={(e) => (
            <Text role="alert" id="shifts.join.error">
              {e.message}
            </Text>
          )}
        >
          <Box direction="column" gap="2">
            <Input field={f.field("name")} label="Name" autocomplete="name" />
            <Input field={f.field("email")} type="email" label="Email" autocomplete="email" />
            <Input field={f.field("phone")} type="tel" label="Phone (optional)" autocomplete="tel" />
            <TextArea field={f.field("needs")} label="Access needs (optional)" autocomplete="off" />
            <Button id="shifts.join.submit" type="submit">
              Sign up
            </Button>
          </Box>
        </Form>
      </If>
    </Box>
  );
}
