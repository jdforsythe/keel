import { form } from "@keel/forms";
import { Form, href } from "@keel/router";
import { For } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Input, Link, Text } from "@keel/ui";
import { ListDraft } from "./ListDraft.schema.ts";
import { board } from "./board.ts";

export const Props = s.object({});

const openCount = (listId: string): number => board.get("todos").filter((t) => t.listId === listId && !t.done).length;

/** Route `todos.index`: every list with its open-todo count, and a Form adding a list. */
export default function ListsPage(_props: Infer<typeof Props>) {
  const f = form(ListDraft);
  // Router `Form` expects Node children, not the compiler's children thunk, so it is called directly and
  // inserted through a `children()` binding (compiler D31).
  const children = (): Node => {
    const name = <Input field={f.field("name")} label="List name" />;
    const submit = <Button id="todos.addList" type="submit" label="Add list" />;
    return Form({
      method: "POST",
      action: "todos.index",
      form: f,
      error: (e) => <Text fg="danger">{e.message}</Text>,
      children: [name, submit],
    });
  };
  return (
    <Box as="section" id="todos.lists" gap="2">
      <Heading id="todos.lists.title" level={1}>
        Lists
      </Heading>
      <Box as="ul" id="todos.lists.items">
        <For each={board.get("lists")} key="id">
          {(list) => (
            <Box as="li" id={`todos.listItem.${list.id}`} direction="row" gap="2">
              <Link id={`todos.listLink.${list.id}`} to={href("todos.list", { listId: list.id })}>
                {list.name}
              </Link>
              <Text id={`todos.openCount.${list.id}`}>{`${openCount(list.id)} open`}</Text>
            </Box>
          )}
        </For>
      </Box>
      {children()}
    </Box>
  );
}
ListsPage.Props = Props;
