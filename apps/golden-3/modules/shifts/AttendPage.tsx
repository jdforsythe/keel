import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Checkbox, Heading, Text } from "@keel/ui";
import { Attendance } from "./Attendance.schema.ts";
import { Board } from "./Board.schema.ts";
import { SignupParams } from "./SignupParams.schema.ts";
import { shifts } from "./shifts.contract.ts";

export const Props = s.object({ params: SignupParams, data: Board });

export default function AttendPage(props: Infer<typeof Props>) {
  const f = form(Attendance, { id: "shifts.attend", initial: { attended: props.data.signups[0]?.attended ?? false } });
  return (
    <Box id="shifts.attendPage" direction="column" gap="3">
      <Heading id="shifts.attend.title" level={1}>
        Attendance
      </Heading>
      <Text id="shifts.attend.who">{`${props.data.signups[0]?.name ?? ""}, ${props.data.shifts[0]?.title ?? ""}`}</Text>
      <Form
        method="POST"
        action={shifts.href("shifts.attend", { signupId: props.params.signupId })}
        form={f}
        error={(e) => (
          <Text role="alert" id="shifts.attend.error">
            {e.message}
          </Text>
        )}
      >
        <Box direction="column" gap="2">
          <Checkbox field={f.field("attended")} label="Attended" />
          <Button id="shifts.attend.save" type="submit">
            Save
          </Button>
        </Box>
      </Form>
    </Box>
  );
}
