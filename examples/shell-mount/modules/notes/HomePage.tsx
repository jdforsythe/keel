import { Box, Heading, Link } from "@keel/ui";
import { notes } from "./notes.contract.ts";

export default function HomePage() {
  return (
    <Box as="main" id="notes.home" direction="column" gap="2" p="4">
      <Heading id="notes.home.title" level={1}>
        Notes
      </Heading>
      <Link id="notes.home.toNote" to={notes.href("notes.note", { noteId: "n1" })}>
        Open note n1
      </Link>
    </Box>
  );
}
