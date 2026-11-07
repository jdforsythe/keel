import { For } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Heading, Text } from "@keel/ui";
import { Graph } from "./Graph.schema.ts";

export const Props = s.object({ graph: Graph });

const KINDS = ["scope", "signal", "computed", "effect", "resource"] as const;

/** The live dependency graph as lists grouped by node kind; each node names the nodes it reads. */
export default function GraphView(props: Infer<typeof Props>) {
  const groups = () =>
    KINDS.map((kind) => ({
      kind,
      nodes: props.graph.nodes
        .filter((n) => n.kind === kind)
        .map((n) => ({
          id: n.id,
          reads: props.graph.edges.filter((e) => e.to === n.id).map((e) => `#${e.from}`),
        })),
    })).filter((g) => g.nodes.length > 0);
  return (
    <Box as="section" id="inspector.graph" direction="column" gap="4">
      <Heading id="inspector.graph.title" level={2} fontSize="xl" weight="semibold" m="0">
        Graph
      </Heading>
      <Text as="p" id="inspector.graph.counts" m="0" font="mono" fontSize="sm" fg="textSecondary">
        {`${props.graph.nodes.length} nodes, ${props.graph.edges.length} edges`}
      </Text>
      <For each={groups()} key="kind">
        {(g) => (
          <Box as="section" id={`inspector.graph.${g.kind}`} direction="column" gap="2">
            <Heading id={`inspector.graph.${g.kind}.title`} level={3} font="mono" fontSize="sm" weight="semibold" m="0">
              {`${g.kind} (${g.nodes.length})`}
            </Heading>
            <Box
              as="ul"
              id={`inspector.graph.${g.kind}.nodes`}
              direction="column"
              gap="hairline"
              bg="divider"
              border="hairline"
              p="0"
              m="0"
            >
              <For each={g.nodes} key="id">
                {(n) => (
                  <Box
                    as="li"
                    id={`inspector.node.${n.id}`}
                    direction="row"
                    px="3"
                    py="2"
                    bg="card"
                    font="mono"
                    fontSize="sm"
                  >
                    {n.reads.length === 0 ? `#${n.id}` : `#${n.id} reads ${n.reads.join(", ")}`}
                  </Box>
                )}
              </For>
            </Box>
          </Box>
        )}
      </For>
    </Box>
  );
}
