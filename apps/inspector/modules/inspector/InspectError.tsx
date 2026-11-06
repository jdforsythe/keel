import { type Infer, s } from "@keel/schema";
import { Box, Heading, Text } from "@keel/ui";

export const Props = s.object({
  error: s.object({ code: s.string(), message: s.string() }),
});

/** `errorElement` of `inspector.index`: the target could not be inspected, and how to fix that. */
export default function InspectError(props: Infer<typeof Props>) {
  return (
    <Box as="section" id="inspector.error" p="3" gap="2">
      <Heading id="inspector.error.title" level={1} fg="danger">
        Cannot inspect
      </Heading>
      <Text as="p" id="inspector.error.message">
        {props.error.message}
      </Text>
      <Text as="p" id="inspector.error.hint">
        Start the app with its Vite dev or preview server and pass its origin as ?url=
      </Text>
    </Box>
  );
}
