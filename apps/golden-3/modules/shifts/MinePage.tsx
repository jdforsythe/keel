import { For } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Heading, Link, Text } from "@keel/ui";
import { Board } from "./Board.schema.ts";
import { shifts } from "./shifts.contract.ts";

export const Props = s.object({ data: Board });

export default function MinePage(props: Infer<typeof Props>) {
  const shiftOf = (shiftId: string) => props.data.shifts.find((x) => x.id === shiftId);
  return (
    <Box id="shifts.mine" direction="column" gap="3">
      <Heading id="shifts.mine.title" level={1}>
        My sign-ups
      </Heading>
      <For
        each={props.data.signups}
        key="id"
        empty={() => <Text id="shifts.mine.empty">You have no sign-ups yet</Text>}
      >
        {(signup) => (
          <Box direction="column" gap="1">
            <Text id={`shifts.mine.shift.${signup.id}`}>
              {`${shiftOf(signup.shiftId)?.title ?? ""}, ${shiftOf(signup.shiftId)?.when ?? ""}`}
            </Text>
            <Link id={`shifts.mine.cancel.${signup.id}`} to={shifts.href("shifts.signup", { signupId: signup.id })}>
              {`Cancel ${shiftOf(signup.shiftId)?.title ?? ""}`}
            </Link>
          </Box>
        )}
      </For>
    </Box>
  );
}
