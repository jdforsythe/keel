import { Box, Heading, Text } from "@keel/ui";

/** A module that does not list `@keel/std-messages`: its copy is literal English. */
export default function TodoList() {
  return (
    <Box as="section" id="todos.list" direction="column">
      <Heading id="todos.list.title" level={1}>
        Todos
      </Heading>
      <Text id="todos.list.empty">Nothing to do</Text>
    </Box>
  );
}
