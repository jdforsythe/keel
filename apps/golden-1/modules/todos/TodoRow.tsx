import { href } from "@keel/router";
import { type Infer, s } from "@keel/schema";
import { tx } from "@keel/store";
import { Box, Checkbox, Link, Text } from "@keel/ui";
import { Todo } from "./Todo.schema.ts";
import { toggleTodo } from "./toggleTodo.ts";

export const Props = s.object({ todo: Todo });
export const uses = [toggleTodo];

/** One todo: a done Checkbox, its priority, and an Edit link. */
export default function TodoRow(props: Infer<typeof Props>) {
  return (
    <Box as="li" id={`todos.row.${props.todo.id}`} direction="row" gap="2">
      <Checkbox
        id={`todos.toggle.${props.todo.id}`}
        label={`Done: ${props.todo.title}`}
        checked={props.todo.done}
        onChange={() => tx(toggleTodo, { id: props.todo.id })}
      />
      <Text id={`todos.priority.${props.todo.id}`} fontSize="sm">
        {props.todo.priority}
      </Text>
      <Link
        id={`todos.editLink.${props.todo.id}`}
        to={href("todos.edit", { listId: props.todo.listId, todoId: props.todo.id })}
      >
        Edit
      </Link>
    </Box>
  );
}
TodoRow.Props = Props;
