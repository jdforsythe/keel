import { href } from "@keel/router";
import { type Infer, s } from "@keel/schema";
import { Box, Heading, Link, Text } from "@keel/ui";

export const Props = s.object({
  error: s.object({ code: s.string(), message: s.string() }),
});

/** `errorElement` of `todos.list` and `todos.edit`: names the error and links home. */
export default function ListError(props: Infer<typeof Props>) {
  return (
    <Box as="section" id="todos.error" p="3" gap="2">
      <Heading id="todos.error.title" level={1} fg="danger">
        Not found
      </Heading>
      <Text as="p" id="todos.error.message">
        {props.error.message}
      </Text>
      <Link id="todos.error.home" to={href("todos.index")}>
        Back to lists
      </Link>
    </Box>
  );
}
ListError.Props = Props;
