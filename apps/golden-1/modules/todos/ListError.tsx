import { type Infer, s } from "@keel/schema";
import { Box, Heading, Link, Text } from "@keel/ui";
import { todos } from "./todos.contract.ts";

export const Props = s.object({
  error: s.object({ code: s.string(), message: s.string() }),
});

/** `errorElement` of `todos.index`, `todos.list` and `todos.edit`: names the error and links home. */
export default function ListError(props: Infer<typeof Props>) {
  return (
    <Box as="section" id="todos.error" direction="column" gap="3" p="4" bg="card" border="error">
      <Text font="mono" fontSize="xs" fg="accent">
        {props.error.code}
      </Text>
      <Heading id="todos.error.title" level={1} fontSize="2xl" weight="semibold" m="0" fg="error">
        Not found
      </Heading>
      <Text as="p" id="todos.error.message" m="0" font="mono" fontSize="sm">
        {props.error.message}
      </Text>
      <Link id="todos.error.home" to={todos.href("todos.index")} fg="text">
        Back to lists
      </Link>
    </Box>
  );
}
