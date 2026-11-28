import { type Infer, s } from "@keel/schema";
import { Box, Heading, Image } from "@keel/ui";
import { Home } from "./Home.schema.ts";

export const Props = s.object({ data: Home });

export default function HomePage(props: Infer<typeof Props>) {
  return (
    <Box as="main" id="app.home" direction="column" gap="2" p="4">
      <Heading id="app.home.title" level={1}>
        {props.data.heading}
      </Heading>
      <Image id="app.home.tile" src="https://tile.openstreetmap.org/0/0/0.png" alt={props.data.alt} />
    </Box>
  );
}
