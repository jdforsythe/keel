import type { Ctx } from "@keel/ctx";
import { type Infer, s } from "@keel/schema";
import { send } from "@keel/std-offline";
import { Box, Checkbox, Link, Text } from "@keel/ui";
import { Todo } from "../api/Todo.schema.ts";
import { boardOutbox } from "./boardOutbox.ts";
import { idPart } from "./idPart.ts";
import { todos } from "./todos.contract.ts";
import { view } from "./view.ts";

export const Props = s.object({ todo: Todo });

/**
 * One todo: a done Checkbox (sends `/api/todos/:todoId/toggle` through the outbox, based on the board as last read;
 * the live board shows the result), priority, Edit link. The list that shows it owns the list item
 * (`todos.row.<id>` in `ListPage`), so a row renders on its own as well.
 */
export default function TodoRow(props: Infer<typeof Props>, ctx: Ctx) {
  const toggle = (): void => {
    const call = { params: { todoId: props.todo.id }, body: {} };
    void send(ctx, boardOutbox, "toggleTodo", call, { base: view.get("head"), owner: "" });
  };
  return (
    <Box
      direction={{ base: "column", md: "row" }}
      wrap="wrap"
      align={{ base: "start", md: "center" }}
      gap={{ base: "2", md: "3" }}
      px="3"
      py="2"
      bg="card"
    >
      <Checkbox
        id={`todos.toggle.${idPart(props.todo.id)}`}
        label={`Done: ${props.todo.title}`}
        checked={props.todo.done}
        onChange={toggle}
      />
      <Text
        id={`todos.priority.${idPart(props.todo.id)}`}
        font="mono"
        fontSize="xs"
        px="2"
        py="1"
        fg={props.todo.priority === "high" ? "accent" : "textSecondary"}
        border={props.todo.priority === "high" ? "accent" : "hairline"}
      >
        {props.todo.priority}
      </Text>
      <Link
        id={`todos.editLink.${idPart(props.todo.id)}`}
        to={todos.href("todos.edit", { listId: props.todo.listId, todoId: props.todo.id })}
        fontSize="sm"
      >
        Edit {props.todo.title}
      </Link>
    </Box>
  );
}
