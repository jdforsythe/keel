import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Input, Select, Text } from "@keel/ui";
import { Todo } from "./Todo.schema.ts";
import { TodoDraft } from "./TodoDraft.schema.ts";

export const Props = s.object({
  params: s.object({ listId: s.id("TodoList"), todoId: s.id("Todo") }),
  data: Todo,
});

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
];

/** Route `todos.edit`: a Form editing the todo's title and priority; success returns to `todos.list`. */
export default function EditTodoPage(props: Infer<typeof Props>) {
  const f = form(TodoDraft, { initial: { title: props.data.title, priority: props.data.priority } });
  // Router `Form` expects Node children, not the compiler's children thunk, so it is called directly and
  // inserted through a `children()` binding (compiler D31).
  const children = (): Node => {
    const title = <Input field={f.field("title")} label="Title" />;
    const priority = <Select field={f.field("priority")} label="Priority" options={PRIORITIES} />;
    const submit = <Button id="todos.save" type="submit" label="Save" />;
    return Form({
      method: "POST",
      action: "todos.edit",
      params: props.params,
      form: f,
      error: (e) => <Text fg="danger">{e.message}</Text>,
      children: [title, priority, submit],
    });
  };
  return (
    <Box as="section" id="todos.edit" gap="2">
      <Heading id="todos.edit.title" level={1}>
        Edit todo
      </Heading>
      {children()}
    </Box>
  );
}
