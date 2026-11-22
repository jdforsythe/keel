import { type Infer, s } from "@keel/schema";
import { Box, Heading, Link } from "@keel/ui";
import { PlaceParams } from "./PlaceParams.schema.ts";
import { places } from "./places.contract.ts";

export const Props = s.object({ params: PlaceParams });

export default function PlacePage(props: Infer<typeof Props>) {
  return (
    <Box as="main" id="places.place" direction="column" gap="2" p="4">
      <Heading id="places.place.title" level={1}>
        {props.params.placeId}
      </Heading>
      <Link id="places.place.toHome" to={places.href("places.home")}>
        All places
      </Link>
    </Box>
  );
}
