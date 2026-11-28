import { Box, Heading, Link } from "@keel/ui";
import { places } from "./places.contract.ts";

export default function HomePage() {
  return (
    <Box as="main" id="places.home" direction="column" gap="2" p="4">
      <Heading id="places.home.title" level={1}>
        Places
      </Heading>
      <Link id="places.home.toLisbon" to={places.href("places.place", { placeId: "lisbon" })}>
        Lisbon
      </Link>
    </Box>
  );
}
