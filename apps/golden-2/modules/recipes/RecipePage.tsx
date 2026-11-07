import { Form } from "@keel/router";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Text } from "@keel/ui";
import { Recipe } from "./Recipe.schema.ts";
import { RecipeParams } from "./RecipeParams.schema.ts";
import { routes } from "./routes.ts";

export const Props = s.object({ params: RecipeParams, data: Recipe });

/** Route `recipes.show`: the recipe and a Form toggling its favorite. */
export default function RecipePage(props: Infer<typeof Props>) {
  // Router `Form` expects Node children, not the compiler's children thunk (compiler D31).
  const children = (): Node => {
    const toggle = (
      <Button
        id="recipes.toggleFavorite"
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
        Toggle favorite
      </Button>
    );
    return Form({
      method: "POST",
      action: routes.href("recipes.show", props.params),
      error: (e) => <Text fg="error">{e.message}</Text>,
      children: [toggle],
    });
  };
  return (
    <Box as="section" id="recipes.show" direction="column" gap="4">
      <Heading id="recipes.show.heading" level={1} font="mono" fontSize="xs" weight="regular" fg="textSecondary" m="0">
        Recipe
      </Heading>
      <Text id="recipes.title" fontSize="2xl" weight="semibold">
        {props.data.title}
      </Text>
      <Box direction="row">
        <Text
          id="recipes.favorite"
          font="mono"
          fontSize="xs"
          px="2"
          py="1"
          fg={props.data.favorite ? "accent" : "textSecondary"}
          border={props.data.favorite ? "accent" : "hairline"}
        >
          {props.data.favorite ? "Favorite" : "Not favorite"}
        </Text>
      </Box>
      {children()}
    </Box>
  );
}
