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
      <Button id="recipes.toggleFavorite" type="submit">
        Toggle favorite
      </Button>
    );
    return Form({
      method: "POST",
      action: routes.href("recipes.show", props.params),
      error: (e) => <Text fg="danger">{e.message}</Text>,
      children: [toggle],
    });
  };
  return (
    <Box as="section" id="recipes.show" gap="2">
      <Heading id="recipes.show.heading" level={1}>
        Recipe
      </Heading>
      <Text id="recipes.title">{props.data.title}</Text>
      <Text id="recipes.favorite">{props.data.favorite ? "Favorite" : "Not favorite"}</Text>
      {children()}
    </Box>
  );
}
