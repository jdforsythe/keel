import type { Ctx } from "@keel/ctx";
import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { For, type Slots } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Input, Link, Select, Text } from "@keel/ui";
import { TodoDraft } from "../api/TodoDraft.schema.ts";
import { TodoList } from "../api/TodoList.schema.ts";
import Suggestions from "./Suggestions.tsx";
import TodoRow from "./TodoRow.tsx";
import { routes } from "./routes.ts";
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

/** Route `todos.list`: the list's todos filtered by `search.filter`, filter links, an add-todo Form, Suggestions. */
export default function ListPage(props: Infer<typeof Props>, _slots?: Slots, ctx?: Ctx) {
  const f = form(TodoDraft, { id: "todos.addForm", initial: { priority: "normal" } });
  const shown = () =>
    view
      .get("todos")
      .filter(
        (t) =>
          t.listId === props.params.listId &&
          (props.search.filter === "done" ? t.done : props.search.filter === "active" ? !t.done : true),
      );
  const listId = props.params.listId;
  // `Form` is a function component returning an element; inserted through a `children()` binding (compiler D31).
  const children = (): Node =>
    Form({
      method: "POST",
      action: routes.href("todos.list", { listId }),
      form: f,
      error: (e) => <Text fg="error">{e.message}</Text>,
      children: () => [
        <Input
          field={f.field("title")}
          label="Title"
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
        />,
        <Select
          field={f.field("priority")}
          label="Priority"
          options={PRIORITIES}
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
        />,
        <Button
          id="todos.addTodo"
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
          Add todo
        </Button>,
      ],
    });
  return (
    <Box as="section" id="todos.list" direction="column" gap="5">
      <Heading id="todos.list.title" level={1} fontSize="2xl" weight="semibold" m="0">
        {props.data.name}
      </Heading>
      <Box as="section" id="todos.filters" direction="row" gap="4" font="mono" fontSize="sm">
        <Link
          id="todos.filter.all"
          to={routes.href("todos.list", { listId: props.params.listId }, { filter: "all" })}
          fg="text"
        >
          All
        </Link>
        <Link
          id="todos.filter.active"
          to={routes.href("todos.list", { listId: props.params.listId }, { filter: "active" })}
          fg="text"
        >
          Active
        </Link>
        <Link
          id="todos.filter.done"
          to={routes.href("todos.list", { listId: props.params.listId }, { filter: "done" })}
          fg="text"
        >
          Done
        </Link>
      </Box>
      <Box as="ul" id="todos.items" direction="column" gap="hairline" bg="divider" border="hairline" p="0" m="0">
        <For each={shown()} key="id">
          {(todo) => <TodoRow todo={todo} />}
        </For>
      </Box>
      {children()}
      <Suggestions />
    </Box>
  );
}
