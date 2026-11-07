import type { Ctx } from "@keel/ctx";
import { href } from "@keel/router";
import type { Slots } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Checkbox, Link, Text } from "@keel/ui";
import { Todo } from "./Todo.schema.ts";
import { hydrate } from "./hydrate.ts";
import { syncAfter } from "./syncAfter.ts";
import { todosApi } from "./todosApi.ts";

export const Props = s.object({ todo: Todo });
export const uses = [hydrate];

/** One todo: a done Checkbox (posts `/api/todos/:todoId/toggle`, then re-reads the board), priority, Edit link. */
export default function TodoRow(props: Infer<typeof Props>, _slots?: Slots, ctx?: Ctx) {
  const toggle = (): void => {
    if (ctx !== undefined)
      void syncAfter(ctx, todosApi(location.origin).toggleTodo({ params: { todoId: props.todo.id } }, ctx));
  };
  return (
    <Box as="li" id={`todos.row.${props.todo.id}`} direction="row" gap="2">
      <Checkbox
        id={`todos.toggle.${props.todo.id}`}
        label={`Done: ${props.todo.title}`}
        checked={props.todo.done}
        onChange={toggle}
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
