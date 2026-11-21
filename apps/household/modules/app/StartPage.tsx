import { type Infer, s } from "@keel/schema";
import { Box, Heading, Link, Text } from "@keel/ui";
import { shopping } from "../shopping/shopping.contract.ts";
import { StartData } from "./StartData.schema.ts";

export const Props = s.object({ data: StartData });

export default function StartPage(props: Infer<typeof Props>) {
  return (
    <Box as="main" id="app.start" p="4" gap="2">
      <Heading id="app.start.heading" level={1}>
        {props.data.heading}
      </Heading>
      <Text id="app.start.intro">{props.data.intro}</Text>
      <Link id="app.start.toList" to={shopping.href("shopping.list")}>
        {props.data.toList}
      </Link>
    </Box>
  );
}
