import { type Infer, s } from "@keel/schema";
import { Box, Heading, Text } from "@keel/ui";
import { Home } from "./Home.schema.ts";

export const Props = s.object({ data: Home });

export default function HomePage(props: Infer<typeof Props>) {
  return (
    <Box as="main" id="shop.home" direction="column" gap="2" p="4">
      <Heading id="shop.home.title" level={1}>
        Shop
      </Heading>
      <Text id="shop.home.shelf">{props.data.shelf}</Text>
    </Box>
  );
}
