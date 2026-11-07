import type { Ctx } from "@keel/ctx";
import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { For, type Slots } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Input, Link, Select, Text } from "@keel/ui";
import Suggestions from "./Suggestions.tsx";
import { TodoDraft } from "./TodoDraft.schema.ts";
import { TodoList } from "./TodoList.schema.ts";
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
  const f = form(TodoDraft, { initial: { priority: "normal" } });
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
      action: "todos.list",
      params: { listId },
      form: f,
      error: (e) => <Text fg="danger">{e.message}</Text>,
      children: () => [
        <Input field={f.field("title")} label="Title" />,
        <Select field={f.field("priority")} label="Priority" options={PRIORITIES} />,
        <Button id="todos.addTodo" type="submit" label="Add todo" />,
      ],
    });
  return (
    <Box as="section" id="todos.list" gap="2">
      <Heading id="todos.list.title" level={1}>
        {props.data.name}
      </Heading>
      <Box as="nav" id="todos.filters" direction="row" gap="2">
        <Link id="todos.filter.all" to={routes.href("todos.list", { listId }, { filter: "all" })}>
          All
        </Link>
        <Link id="todos.filter.active" to={routes.href("todos.list", { listId }, { filter: "active" })}>
          Active
        </Link>
        <Link id="todos.filter.done" to={routes.href("todos.list", { listId }, { filter: "done" })}>
          Done
        </Link>
      </Box>
      <Box as="ul" id="todos.items">
        <For each={shown()} key="id">
          {(todo) => <TodoRow todo={todo} />}
        </For>
      </Box>
      {children()}
      <Suggestions />
    </Box>
  );
}
