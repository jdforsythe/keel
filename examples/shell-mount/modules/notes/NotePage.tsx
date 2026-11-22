import { type Infer, s } from "@keel/schema";
import { Box, Heading } from "@keel/ui";
import { NoteParams } from "./NoteParams.schema.ts";

export const Props = s.object({ params: NoteParams });

export default function NotePage(props: Infer<typeof Props>) {
  return (
    <Box as="main" id="notes.note" direction="column" gap="2" p="4">
      <Heading id="notes.note.title" level={1}>
        {`Note ${props.params.noteId}`}
      </Heading>
    </Box>
  );
}
