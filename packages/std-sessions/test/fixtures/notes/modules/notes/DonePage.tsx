import { type Infer, s } from "@keel/schema";
import { Box, Text } from "@keel/ui";
import { notes } from "./notes.ts";

export const Props = s.object({});

/** Route `notes.done`: the notes so far and the caller the server last named. */
export default function DonePage(_props: Infer<typeof Props>) {
  return (
    <Box as="main" id="notes.done" direction="column">
      <Text id="notes.count">{String(notes.get("items").length)}</Text>
      <Text id="notes.caller">{notes.get("caller")}</Text>
    </Box>
  );
}
