import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Input, Select, Text } from "@keel/ui";
import { Todo } from "../api/Todo.schema.ts";
import { TodoDraft } from "../api/TodoDraft.schema.ts";
import { routes } from "./routes.ts";

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
  const f = form(TodoDraft, {
    id: "todos.editForm",
    initial: { title: props.data.title, priority: props.data.priority },
  });
  // Router `Form` expects Node children, not the compiler's children thunk, so it is called directly and
  // inserted through a `children()` binding (compiler D31).
  const children = (): Node => {
    const title = (
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
      />
    );
    const priority = (
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
      />
    );
    const submit = (
      <Button
        id="todos.save"
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
        Save
      </Button>
    );
    return Form({
      method: "POST",
      action: routes.href("todos.edit", props.params),
      form: f,
      error: (e) => <Text fg="error">{e.message}</Text>,
      children: [title, priority, submit],
    });
  };
  return (
    <Box as="section" id="todos.edit" direction="column" gap="5">
      <Heading id="todos.edit.title" level={1} fontSize="2xl" weight="semibold" m="0">
        Edit todo
      </Heading>
      {children()}
    </Box>
  );
}
