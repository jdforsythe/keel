import { type Infer, s } from "@keel/schema";
import { Box, Heading, Text } from "@keel/ui";

export const Props = s.object({});

export default function StartPage(_props: Infer<typeof Props>) {
  return (
    <Box as="main" id="app.start" direction="column" gap="3" p="5">
      <Heading id="app.start.title" level={1}>
        Evenly
      </Heading>
      <Text id="app.start.lede">
        I keep a trip's shared costs in one place, so nobody has to remember who paid for the taxi.
      </Text>
      <Text id="app.start.next">Add the people on your trip, then the first cost.</Text>
    </Box>
  );
}
