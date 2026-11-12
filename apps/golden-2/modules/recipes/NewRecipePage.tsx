import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { type Infer, s } from "@keel/schema";
import { Currency } from "@keel/std-money";
import { Box, Button, Heading, Input, Select, Text } from "@keel/ui";
import { RecipeDraft } from "../kitchen/RecipeDraft.schema.ts";
import { LocaleParams } from "./LocaleParams.schema.ts";
import { TextData } from "./TextData.schema.ts";
import { fieldText } from "./fieldText.ts";
import { routes } from "./routes.ts";

export const Props = s.object({ params: LocaleParams, data: TextData });

/** The currencies a price may take, read from `Currency`; a code is its own label. */
const currencies: readonly { readonly value: string; readonly label: string }[] =
  Currency.node.kind === "enum" ? Currency.node.values.map((c) => ({ value: c, label: c })) : [];

/** Route `recipes.new`: a Form adding a recipe with a price in minor units; success goes to the index. */
export default function NewRecipePage(props: Infer<typeof Props>) {
  const f = form(RecipeDraft, {
    id: "recipes.draft",
    initial: { price: { currency: "EUR" } },
    issueText: fieldText(props.data.text),
  });
  // Router `Form` expects Node children, not the compiler's children thunk (compiler D31).
  const children = (): Node => {
    const title = (
      <Input
        field={f.field("title")}
        label={props.data.text.titleLabel}
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
        type="number"
        label={props.data.text.minutesLabel}
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
    const amount = (
      <Input
        field={f.field("price.amount")}
        type="number"
        label={props.data.text.amountLabel}
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
    const currency = (
      <Select
        field={f.field("price.currency")}
        label={props.data.text.currencyLabel}
        options={currencies}
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
        {props.data.text.save}
      </Button>
    );
    return Form({
      method: "POST",
      action: routes.href("recipes.new", { locale: props.params.locale }),
      form: f,
      error: (e) => <Text fg="error">{e.message}</Text>,
      children: [title, minutes, amount, currency, submit],
    });
  };
  return (
    <Box as="section" id="recipes.new" direction="column" gap="5">
      <Heading id="recipes.new.heading" level={1} fontSize="2xl" weight="semibold" m="0">
        {props.data.text.newHeading}
      </Heading>
      {children()}
    </Box>
  );
}
