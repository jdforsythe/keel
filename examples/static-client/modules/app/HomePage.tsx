import { type Infer, s } from "@keel/schema";
import { Box, Heading, Text } from "@keel/ui";
import { Home } from "./Home.schema.ts";

export const Props = s.object({ data: Home });

export default function HomePage(props: Infer<typeof Props>) {
  return (
    <Box as="main" id="app.home" gap="2" p="4">
      <Heading id="app.home.title" level={1}>
        {props.data.heading}
      </Heading>
      <Text id="app.home.note">{props.data.note}</Text>
    </Box>
  );
}
