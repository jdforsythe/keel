import { For } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Heading, Link, Text } from "@keel/ui";
import { ShiftList } from "./ShiftList.schema.ts";
import { shifts } from "./shifts.contract.ts";

export const Props = s.object({ data: ShiftList });

export default function IndexPage(props: Infer<typeof Props>) {
  return (
    <Box id="shifts.index" direction="column" gap="3">
      <Heading id="shifts.title" level={1}>
        Volunteer shifts
      </Heading>
      <For each={props.data.items} key="id">
        {(item) => (
          <Box direction="column" gap="1">
            <Link id={`shifts.link.${item.id}`} to={shifts.href("shifts.show", { shiftId: item.id })}>
              {item.title}
            </Link>
            <Text id={`shifts.when.${item.id}`}>{item.when}</Text>
            <Text id={`shifts.open.${item.id}`}>{`${item.open} of ${item.slots} places open`}</Text>
          </Box>
        )}
      </For>
    </Box>
  );
}
