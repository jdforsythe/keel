import { type Infer, s } from "@keel/schema";
import { Form } from "@keel/router";
import { Box, Button, Text } from "@keel/ui";
import { a } from "./a.contract.ts";
import { Count } from "./Count.schema.ts";
export const Props = s.object({ data: Count });
export default function HomePage(props: Infer<typeof Props>) {
  return (
    <Box as="main">
      <Text id="a.count">{String(props.data.count)}</Text>
      <Form method="POST" action={a.href("a.home")}>
        <Button id="a.add" type="submit">Add</Button>
      </Form>
    </Box>
  );
}
