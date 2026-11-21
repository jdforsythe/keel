import { For } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Heading, Host, Text } from "@keel/ui";
import { Bars } from "./Bars.schema.ts";
import { Home } from "./Home.schema.ts";

export const Props = s.object({ data: Home });

export default function HomePage(props: Infer<typeof Props>) {
  return (
    <Box as="main" id="app.home" gap="2" p="4">
      <Heading id="app.home.title" level={1}>
        {props.data.heading}
      </Heading>
      <Host
        id="app.home.chart"
        role="img"
        label={props.data.chart}
        describedBy="app.home.values"
        input={Bars}
        value={props.data.rain}
        code={() => import("./barChart.ts").then((m) => m.barChart)}
      />
      <Box as="ul" id="app.home.values">
        <For each={props.data.rain.bars} key="name">
          {(bar) => (
            <Box as="li">
              <Text>{`${bar.name}: ${bar.value}`}</Text>
            </Box>
          )}
        </For>
      </Box>
    </Box>
  );
}
