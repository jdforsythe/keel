import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { For } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Input, Link, Text } from "@keel/ui";
import { ListDraft } from "./ListDraft.schema.ts";
import { routes } from "./routes.ts";
import { view } from "./view.ts";

export const Props = s.object({});

const openCount = (listId: string): number => view.get("todos").filter((t) => t.listId === listId && !t.done).length;

/** Route `todos.index`: every list with its open-todo count, and a Form adding a list. */
export default function ListsPage(_props: Infer<typeof Props>) {
  const f = form(ListDraft);
  // Router `Form` expects Node children, not the compiler's children thunk, so it is called directly and
  // inserted through a `children()` binding (compiler D31).
  const children = (): Node => {
    const name = (
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
    );
    const submit = (
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
    );
    return Form({
      method: "POST",
      action: routes.href("todos.index"),
      form: f,
      error: (e) => <Text fg="error">{e.message}</Text>,
      children: [name, submit],
    });
  };
  return (
    <Box as="section" id="todos.lists" direction="column" gap="5">
      <Heading id="todos.lists.title" level={1} fontSize="2xl" weight="semibold" m="0">
        Lists
      </Heading>
      <Box as="ul" id="todos.lists.items" direction="column" gap="hairline" bg="divider" border="hairline" p="0" m="0">
        <For each={view.get("lists")} key="id">
          {(list) => (
            <Box
              as="li"
              id={`todos.listItem.${list.id}`}
              direction="row"
              justify="between"
              align="baseline"
              gap="3"
              px="3"
              py="3"
              bg="card"
            >
              <Link id={`todos.listLink.${list.id}`} to={routes.href("todos.list", { listId: list.id })} fg="text">
                {list.name}
              </Link>
              <Text
                id={`todos.openCount.${list.id}`}
                font="mono"
                fontSize="xs"
                fg="accent"
                border="accent"
                px="2"
                py="1"
              >{`${openCount(list.id)} open`}</Text>
            </Box>
          )}
        </For>
      </Box>
      {children()}
    </Box>
  );
}
