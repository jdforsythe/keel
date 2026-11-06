import { form } from "@keel/forms";
import { Form, href } from "@keel/router";
import { For } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Input, Link, Select, Text } from "@keel/ui";
import Suggestions from "./Suggestions.tsx";
import { TodoDraft } from "./TodoDraft.schema.ts";
import { TodoList } from "./TodoList.schema.ts";
import TodoRow from "./TodoRow.tsx";
import { board } from "./board.ts";

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
export default function ListPage(props: Infer<typeof Props>) {
  const f = form(TodoDraft, { initial: { priority: "normal" } });
  const shown = () =>
    board
      .get("todos")
      .filter(
        (t) =>
          t.listId === props.params.listId &&
          (props.search.filter === "done" ? t.done : props.search.filter === "active" ? !t.done : true),
      );
  const listId = props.params.listId;
  // Router `Form` expects Node children, not the compiler's children thunk, so it is called directly and
  // inserted through a `children()` binding (compiler D31).
  const children = (): Node => {
    const title = <Input field={f.field("title")} label="Title" />;
    const priority = <Select field={f.field("priority")} label="Priority" options={PRIORITIES} />;
    const submit = <Button id="todos.addTodo" type="submit" label="Add todo" />;
    return Form({
      method: "POST",
      action: "todos.list",
      params: { listId },
      form: f,
      error: (e) => <Text fg="danger">{e.message}</Text>,
      children: [title, priority, submit],
    });
  };
  return (
    <Box as="section" id="todos.list" gap="2">
      <Heading id="todos.list.title" level={1}>
        {props.data.name}
      </Heading>
      <Box as="nav" id="todos.filters" direction="row" gap="2">
        <Link id="todos.filter.all" to={href("todos.list", { listId }, { filter: "all" })}>
          All
        </Link>
        <Link id="todos.filter.active" to={href("todos.list", { listId }, { filter: "active" })}>
          Active
        </Link>
        <Link id="todos.filter.done" to={href("todos.list", { listId }, { filter: "done" })}>
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
ListPage.Props = Props;
