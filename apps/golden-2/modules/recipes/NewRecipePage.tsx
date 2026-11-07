import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Input, Text } from "@keel/ui";
import { RecipeDraft } from "./RecipeDraft.schema.ts";
import { routes } from "./routes.ts";

export const Props = s.object({});

/** Route `recipes.new`: a Form adding a recipe; success goes to the index. */
export default function NewRecipePage(_props: Infer<typeof Props>) {
  const f = form(RecipeDraft, { id: "recipes.draft" });
  // Router `Form` expects Node children, not the compiler's children thunk (compiler D31).
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
    const minutes = (
      <Input
        field={f.field("minutes")}
        label="Minutes"
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
        id="recipes.save"
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
      action: routes.href("recipes.new"),
      form: f,
      error: (e) => <Text fg="error">{e.message}</Text>,
      children: [title, minutes, submit],
    });
  };
  return (
    <Box as="section" id="recipes.new" direction="column" gap="5">
      <Heading id="recipes.new.heading" level={1} fontSize="2xl" weight="semibold" m="0">
        New recipe
      </Heading>
      {children()}
    </Box>
  );
}
