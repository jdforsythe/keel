import type { Ctx } from "@keel/ctx";
import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { For } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Input, Link, Text } from "@keel/ui";
import { ListDraft } from "../api/ListDraft.schema.ts";
import type { TodoList } from "../api/TodoList.schema.ts";
import { idPart } from "./idPart.ts";
import { refreshView } from "./refreshView.ts";
import { todos } from "./todos.contract.ts";
import { todosApi } from "./todosApi.ts";
import { view } from "./view.ts";

export const Props = s.object({});

const openCount = (listId: string): number => view.get("todos").filter((t) => t.listId === listId && !t.done).length;
const shown = () => view.get("lists").filter((l) => l.hidden !== true);
const nameOf = (listId: string): string => view.get("lists").find((l) => l.id === listId)?.name ?? listId;
/** The removals someone can still undo: their list is hidden and waits (`hidden`). */
const waiting = () => (view.get("removals") ?? []).filter((r) => r.state === "hidden");

/**
 * Route `todos.index`: every shown list with its open-todo count and a Remove button, a bar per removal that still
 * waits with its Undo, and a Form adding a list. Remove hides the list at once; the `api` deployable deletes it 10
 * minutes later unless Undo comes first. Both re-read the board.
 */
export default function ListsPage(_props: Infer<typeof Props>, ctx: Ctx) {
  const remove = (listId: TodoList["id"]): void => {
    void todosApi.removeList({ params: { listId } }, ctx).then(() => refreshView(ctx));
  };
  const undo = (flow: string): void => {
    void todosApi.undoRemoval({ params: { flow } }, ctx).then(() => refreshView(ctx));
  };
  const f = form(ListDraft);
  return (
    <Box as="section" id="todos.lists" direction="column" gap="5">
      <Heading id="todos.lists.title" level={1} fontSize="2xl" weight="semibold" m="0">
        Lists
      </Heading>
      <For each={waiting()} key="flow">
        {(r) => (
          <Box
            id={`todos.removal.${idPart(r.flow)}`}
            direction="row"
            justify="between"
            align="center"
            gap="3"
            px="3"
            py="2"
            bg="surfaceLow"
            border="hairline"
          >
            <Text fontSize="sm">{`${nameOf(r.list)} is removed in 10 minutes.`}</Text>
            <Button
              id={`todos.undo.${idPart(r.flow)}`}
              onClick={() => undo(r.flow)}
              font="mono"
              fontSize="sm"
              px="3"
              py="1"
              bg="card"
              fg="text"
              border="rule"
              radius="none"
            >
              Undo
            </Button>
          </Box>
        )}
      </For>
      <Box as="ul" id="todos.lists.items" direction="column" gap="hairline" bg="divider" border="hairline" p="0" m="0">
        <For each={shown()} key="id">
          {(list) => (
            <Box
              as="li"
              id={`todos.listItem.${idPart(list.id)}`}
              direction="row"
              justify="between"
              align="baseline"
              gap="3"
              px="3"
              py="3"
              bg="card"
            >
              <Link
                id={`todos.listLink.${idPart(list.id)}`}
                to={todos.href("todos.list", { listId: list.id })}
                fg="text"
              >
                {list.name}
              </Link>
              <Text
                id={`todos.openCount.${idPart(list.id)}`}
                font="mono"
                fontSize="xs"
                fg="accent"
                border="accent"
                px="2"
                py="1"
              >{`${openCount(list.id)} open`}</Text>
              <Button
                id={`todos.remove.${idPart(list.id)}`}
                onClick={() => remove(list.id)}
                font="mono"
                fontSize="xs"
                px="2"
                py="1"
                bg="card"
                fg="text"
                border="rule"
                radius="none"
              >
                Remove
              </Button>
            </Box>
          )}
        </For>
      </Box>
      <Form
        method="POST"
        action={todos.href("todos.index")}
        form={f}
        error={(e) => <Text fg="error">{e.message}</Text>}
      >
        <Input
          field={f.field("name")}
          label="List name"
          font="serif"
          fontSize="md"
          px="2"
          py="2"
          mx="2"
          my="1"
          bg="card"
          fg="text"
          border="control"
          radius="none"
        />
        <Button
          id="todos.addList"
          type="submit"
          font="mono"
          fontSize="sm"
          px="4"
          py="2"
          my="2"
          bg="text"
          fg="card"
          border="rule"
          radius="none"
        >
          Add list
        </Button>
      </Form>
    </Box>
  );
}
