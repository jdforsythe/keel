import { type Infer, s } from "@keel/schema";
import { Box, Heading, Text } from "@keel/ui";
import Masthead from "./Masthead.tsx";
import { UnreachableData } from "./UnreachableData.schema.ts";
import { unreachableText } from "./unreachableText.ts";

export const Props = s.object({
  error: s.object({ code: s.string(), message: s.string() }),
});

/** The target and why for `inspector.unreachable` (its `data`, which every error carries), else the error's message. */
const textOf = (e: Infer<typeof Props>["error"]): string => {
  const d = UnreachableData.parse(Reflect.get(e, "data"));
  return d.ok ? unreachableText(d.value) : e.message;
};

/** `errorElement` of `inspector.index`: the target could not be inspected, and how to fix that. */
export default function InspectError(props: Infer<typeof Props>) {
  return (
    <Box as="section" id="inspector.error" direction="column" bg="surface" fg="text" font="serif" fontSize="md">
      <Masthead />
      <Box h="hairline" bg="divider" />
      <Box direction="column" gap="3" m={{ base: "3", md: "6" }} p="4" bg="card" border="error">
        <Text font="mono" fontSize="xs" fg="accent">
          {props.error.code}
        </Text>
        <Heading id="inspector.error.title" level={1} fontSize="xl" weight="semibold" m="0" fg="error">
          Cannot inspect
        </Heading>
        <Text as="p" id="inspector.error.message" m="0" font="mono" fontSize="sm">
          {textOf(props.error)}
        </Text>
        <Text as="p" id="inspector.error.hint" m="0">
          Start the app with its Vite dev or preview server and pass its origin as ?url=
        </Text>
      </Box>
    </Box>
  );
}
