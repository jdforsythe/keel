import { Form } from "@keel/router";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Text } from "@keel/ui";
import { Board } from "./Board.schema.ts";
import { SignupParams } from "./SignupParams.schema.ts";
import { shifts } from "./shifts.contract.ts";

export const Props = s.object({ params: SignupParams, data: Board });

export default function SignupPage(props: Infer<typeof Props>) {
  return (
    <Box id="shifts.signupPage" direction="column" gap="3">
      <Heading id="shifts.signup.title" level={1}>
        Cancel your sign-up
      </Heading>
      <Text id="shifts.signup.shift">{`${props.data.shifts[0]?.title ?? ""}, ${props.data.shifts[0]?.when ?? ""}`}</Text>
      <Form
        method="POST"
        action={shifts.href("shifts.signup", { signupId: props.params.signupId })}
        error={(e) => (
          <Text role="alert" id="shifts.signup.error">
            {e.message}
          </Text>
        )}
      >
        <Button id="shifts.cancel" type="submit">
          Cancel sign-up
        </Button>
      </Form>
    </Box>
  );
}
