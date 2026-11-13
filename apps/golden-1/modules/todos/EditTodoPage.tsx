import { form } from "@keel/forms";
import { computed } from "@keel/reactive";
import { Form } from "@keel/router";
import { If } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Input, Select, Text } from "@keel/ui";
import { Todo } from "../api/Todo.schema.ts";
import { TodoDraft } from "../api/TodoDraft.schema.ts";
import { editorChart } from "./editorChart.ts";
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

/** What `todos.edit.status` says for each `editorChart` state; empty says nothing. */
function statusOf(state: string, attempts: number): string {
  if (state === "saving" && attempts > 1) return "Not saved. Save to try again.";
  if (state === "conflict") return "Someone changed this todo first. Choose Keep mine or Keep theirs in the outbox.";
  if (state === "gaveUp") return "Not saved after 3 tries. Reload the page to edit again.";
  return "";
}

/**
 * Route `todos.edit`: a Form editing the todo's title and priority; success returns to `todos.list`. Its status is
 * `editorChart`'s: `todos.edit.status` names a failed try, a refused edit or a given-up one, and Save is off while
 * the chart holds a refused edit (`conflict`) or has given up (`gaveUp`).
 */
export default function EditTodoPage(props: Infer<typeof Props>) {
  const status = computed(() => statusOf(editorChart.store.get("state"), editorChart.store.get("data").attempts));
  const blocked = computed(() => {
    const state = editorChart.store.get("state");
    return state === "conflict" || state === "gaveUp";
  });
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
        disabled={blocked}
        states={{ disabled: { fg: "textSecondary", border: "control" } }}
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
      <If when={status.get() !== ""}>
        {() => (
          <Text id="todos.edit.status" font="mono" fontSize="sm" fg="error">
            {status.get()}
          </Text>
        )}
      </If>
      {children()}
    </Box>
  );
}
