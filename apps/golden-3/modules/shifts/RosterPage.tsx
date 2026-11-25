import { For } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Heading, Link, Text } from "@keel/ui";
import { Board } from "./Board.schema.ts";
import { shifts } from "./shifts.contract.ts";

export const Props = s.object({ data: Board });

export default function RosterPage(props: Infer<typeof Props>) {
  return (
    <Box id="shifts.rosterPage" direction="column" gap="3">
      <Heading id="shifts.roster.title" level={1}>
        Roster
      </Heading>
      <For each={props.data.shifts} key="id">
        {(shift) => (
          <Box direction="column" gap="2">
            <Heading id={`shifts.roster.shift.${shift.id}`} level={2}>
              {shift.title}
            </Heading>
            <For each={props.data.signups.filter((x) => x.shiftId === shift.id)} key="id">
              {(signup) => (
                <Box direction="column" gap="1">
                  <Text id={`shifts.roster.name.${signup.id}`}>{signup.name}</Text>
                  <Text id={`shifts.roster.email.${signup.id}`}>{signup.email}</Text>
                  <Text id={`shifts.roster.phone.${signup.id}`}>{signup.phone ?? "No phone"}</Text>
                  <Text id={`shifts.roster.needs.${signup.id}`}>{signup.needs ?? "None given"}</Text>
                  <Text id={`shifts.roster.attended.${signup.id}`}>{signup.attended ? "Attended" : "Not yet"}</Text>
                  <Link
                    id={`shifts.roster.mark.${signup.id}`}
                    to={shifts.href("shifts.attend", { signupId: signup.id })}
                  >
                    {`Attendance for ${signup.name}`}
                  </Link>
                </Box>
              )}
            </For>
          </Box>
        )}
      </For>
    </Box>
  );
}
