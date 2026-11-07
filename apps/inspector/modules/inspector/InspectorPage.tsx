import { type Infer, s } from "@keel/schema";
import { Box, Heading, Text } from "@keel/ui";
import GraphView from "./GraphView.tsx";
import IdsView from "./IdsView.tsx";
import { Inspection } from "./Inspection.schema.ts";
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
    <Box as="main" id="inspector.page" p="3" gap="3" bg="bg" fg="fg">
      <Heading id="inspector.title" level={1}>
        {`Inspector: ${props.data.url}`}
      </Heading>
      <Text as="p" id="inspector.live">
        {props.data.live
          ? "Live: graph and stores from the running app"
          : "Not live: open the app in a dev build for graph and stores"}
      </Text>
      <Text as="p" id="inspector.routes">
        {`Routes: ${routes()}`}
      </Text>
      <GraphView graph={props.data.graph} />
      <StoresView stores={props.data.stores} />
      <IdsView ids={props.data.ids} a11y={props.data.a11y} />
      <SectionsView sections={props.data.sections} />
    </Box>
  );
}
