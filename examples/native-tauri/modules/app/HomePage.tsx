import { type Infer, s } from "@keel/schema";
import { Box, Heading, Text } from "@keel/ui";
import Masthead from "./Masthead.tsx";

export const Props = s.object({});

export default function HomePage(_props: Infer<typeof Props>) {
  return (
    <Box id="app.home" direction="column" gap="2">
      <Masthead />
      <Box as="main" direction="column" gap="2" p="4">
        <Heading id="app.home.title" level={1}>
          One page in a Tauri shell
        </Heading>
        <Text id="app.home.note">This page runs on the device. There is no server behind it.</Text>
      </Box>
    </Box>
  );
}
