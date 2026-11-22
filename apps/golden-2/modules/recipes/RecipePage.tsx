import { form } from "@keel/forms";
import { computed } from "@keel/reactive";
import { Form } from "@keel/router";
import { type Infer, s } from "@keel/schema";
import { formatMessage } from "@keel/std-messages";
import { formatMoney } from "@keel/std-money";
import { durationOf, formatDate, formatDuration } from "@keel/std-temporal";
import { Box, Button, Heading, Text } from "@keel/ui";
import { Nothing } from "../kitchen/Nothing.schema.ts";
import { RecipeData } from "./RecipeData.schema.ts";
import { RecipeParams } from "./RecipeParams.schema.ts";
import { recipes } from "./recipes.contract.ts";

export const Props = s.object({ params: RecipeParams, data: RecipeData });

/** Route `recipes.show`: the recipe, its price, time and date, and a Form toggling its favorite (disabled while sent). */
export default function RecipePage(props: Infer<typeof Props>) {
  const f = form(Nothing, { id: "recipes.favoriteForm" });
  const sending = computed(() => f.pending());
  return (
    <Box as="section" id="recipes.show" direction="column" gap="4">
      <Heading id="recipes.show.heading" level={1} font="mono" fontSize="xs" weight="regular" fg="textSecondary" m="0">
        {props.data.text.recipeHeading}
      </Heading>
      <Text id="recipes.title" fontSize="2xl" weight="semibold">
        {props.data.recipe.title}
      </Text>
      <Box direction="row" gap="4" font="mono" fontSize="sm" fg="textSecondary">
        <Text id="recipes.price">{formatMoney(props.data.recipe.price, props.params.locale)}</Text>
        <Text id="recipes.minutes">
          {formatDuration(durationOf(props.data.recipe.minutes * 60_000), props.params.locale, "short")}
        </Text>
      </Box>
      <Text id="recipes.addedOn" font="mono" fontSize="xs" fg="textSecondary">
        {formatMessage(
          props.data.text.addedOn,
          { date: formatDate(props.data.recipe.addedOn, props.params.locale, "long") },
          props.params.locale,
        )}
      </Text>
      <Box direction="row">
        <Text
          id="recipes.favorite"
          font="mono"
          fontSize="xs"
          px="2"
          py="1"
          fg={props.data.recipe.favorite ? "accent" : "textSecondary"}
          border={props.data.recipe.favorite ? "accent" : "hairline"}
        >
          {props.data.recipe.favorite ? props.data.text.favorite : props.data.text.notFavorite}
        </Text>
      </Box>
      <Form
        method="POST"
        action={recipes.href("recipes.show", props.params)}
        form={f}
        error={(e) => (
          <Text role="alert" fg="error">
            {e.message}
          </Text>
        )}
      >
        <Button
          id="recipes.toggleFavorite"
          type="submit"
          disabled={sending}
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
          {props.data.text.toggleFavorite}
        </Button>
      </Form>
    </Box>
  );
}
