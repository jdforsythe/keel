import { type Infer, s } from "@keel/schema";
import { Box, Heading, Text } from "@keel/ui";
import GraphView from "./GraphView.tsx";
import IdsView from "./IdsView.tsx";
import { Inspection } from "./Inspection.schema.ts";
import Masthead from "./Masthead.tsx";
import SectionsView from "./SectionsView.tsx";
import StoresView from "./StoresView.tsx";

export const Props = s.object({
  search: s.object({ url: s.string().optional() }),
  data: Inspection,
});

/** Route `inspector.index`: the inspect document of `?url=` as graph, stores, ids, and inspector section views. */
export default function InspectorPage(props: Infer<typeof Props>) {
  const routes = () => Object.keys(props.data.routes).sort().join(", ");
  return (
    <Box as="main" id="inspector.page" direction="column" bg="surface" fg="text" font="serif" fontSize="md">
      <Masthead />
      <Box h="hairline" bg="divider" />
      <Box direction="column" gap="6" px={{ base: "3", md: "6" }} py="6">
        <Box direction="column" gap="3">
          <Heading id="inspector.title" level={1} fontSize="xl" weight="semibold" m="0">
            {`Inspector: ${props.data.url}`}
          </Heading>
          <Box direction="row">
            <Text
              as="p"
              id="inspector.live"
              m="0"
              px="2"
              py="1"
              font="mono"
              fontSize="xs"
              fg={props.data.live ? "accent" : "textSecondary"}
              border={props.data.live ? "accent" : "hairline"}
            >
              {props.data.live
                ? "Live: graph and stores from the running app"
                : "Not live: open the app in a dev build for graph and stores"}
            </Text>
          </Box>
          <Text as="p" id="inspector.routes" m="0" font="mono" fontSize="sm" fg="textSecondary">
            {`Routes: ${routes()}`}
          </Text>
        </Box>
        <Box h="hairline" bg="divider" />
        <GraphView graph={props.data.graph} />
        <Box h="hairline" bg="divider" />
        <StoresView stores={props.data.stores} />
        <Box h="hairline" bg="divider" />
        <IdsView ids={props.data.ids} a11y={props.data.a11y} />
        <Box h="hairline" bg="divider" />
        <SectionsView sections={props.data.sections} />
      </Box>
    </Box>
  );
}
