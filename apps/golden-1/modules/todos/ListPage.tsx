import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { For, If } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Input, Link, Select, Text } from "@keel/ui";
import { TodoDraft } from "../api/TodoDraft.schema.ts";
import { TodoList } from "../api/TodoList.schema.ts";
import Suggestions from "./Suggestions.tsx";
import TodoRow from "./TodoRow.tsx";
import { idPart } from "./idPart.ts";
import { todos } from "./todos.contract.ts";
import { view } from "./view.ts";

export const Props = s.object({
  params: s.object({ listId: s.id("TodoList") }),
  search: s.object({ filter: s.enum(["all", "active", "done"]).optional() }),
  data: TodoList,
});

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
];

/** What `todos.items.empty` says when the filter shows no todo. */
function emptyOf(filter: "all" | "active" | "done" | undefined): string {
  if (filter === "active") return "No open todos. Everything here is done.";
  if (filter === "done") return "No done todos yet.";
  return "No todos yet. Add the first one below.";
}

/** Route `todos.list`: the list's todos filtered by `search.filter`, filter links, an add-todo Form, Suggestions. */
export default function ListPage(props: Infer<typeof Props>) {
  const f = form(TodoDraft, { id: "todos.addForm", initial: { priority: "normal" } });
  const shown = () =>
    view
      .get("todos")
      .filter(
        (t) =>
          t.listId === props.params.listId &&
          (props.search.filter === "done" ? t.done : props.search.filter === "active" ? !t.done : true),
      );
  return (
    <Box as="section" id="todos.list" direction="column" gap="5">
      <Heading id="todos.list.title" level={1} fontSize="2xl" m="0">
        {props.data.name}
      </Heading>
      <Box as="section" id="todos.filters" direction="row" gap="4" font="mono" fontSize="sm">
        <Link id="todos.filter.all" to={todos.href("todos.list", { listId: props.params.listId }, { filter: "all" })}>
          All
        </Link>
        <Link
          id="todos.filter.active"
          to={todos.href("todos.list", { listId: props.params.listId }, { filter: "active" })}
        >
          Active
        </Link>
        <Link id="todos.filter.done" to={todos.href("todos.list", { listId: props.params.listId }, { filter: "done" })}>
          Done
        </Link>
      </Box>
      <If
        when={shown().length > 0}
        fallback={() => (
          <Text as="p" id="todos.items.empty" m="0" fg="textSecondary">
            {emptyOf(props.search.filter)}
          </Text>
        )}
      >
        {() => (
          <Box as="ul" id="todos.items" direction="column" gap="hairline" bg="divider" border="hairline" p="0" m="0">
            <For each={shown()} key="id">
              {(todo) => (
                <Box as="li" id={`todos.row.${idPart(todo.id)}`} direction="column">
                  <TodoRow todo={todo} />
                </Box>
              )}
            </For>
          </Box>
        )}
      </If>
      <Form
        method="POST"
        action={todos.href("todos.list", { listId: props.params.listId })}
        form={f}
        error={(e) => (
          <Text role="alert" fg="error">
            {e.message}
          </Text>
        )}
      >
        <Box direction="column" gap="3" p={{ base: "3", md: "4" }} bg="card" border="hairline">
          <Input field={f.field("title")} label="Title" />
          <Select field={f.field("priority")} label="Priority" options={PRIORITIES} />
          <Box direction="row">
            <Button id="todos.addTodo" type="submit">
              Add todo
            </Button>
          </Box>
        </Box>
      </Form>
      <Suggestions />
    </Box>
  );
}
