import { For, If } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Heading, Link, Text } from "@keel/ui";
import { Recipe } from "./Recipe.schema.ts";
import { RecipeSearch } from "./RecipeSearch.schema.ts";
import { routes } from "./routes.ts";

export const Props = s.object({ search: RecipeSearch, data: s.object({ recipes: s.array(Recipe) }) });

/** Route `recipes.index`: the recipes (or only favorites) with filter links. */
export default function RecipeList(props: Infer<typeof Props>) {
  return (
    <Box as="section" id="recipes.list" direction="column" gap="5">
      <Heading id="recipes.list.title" level={1} fontSize="2xl" weight="semibold" m="0">
        Recipes
      </Heading>
      <Box as="nav" id="recipes.filters" direction="row" gap="4" font="mono" fontSize="sm">
        <Link id="recipes.filter.all" to={routes.href("recipes.index", {}, { only: "all" })} fg="text">
          All
        </Link>
        <Link id="recipes.filter.favorites" to={routes.href("recipes.index", {}, { only: "favorites" })} fg="text">
          Favorites
        </Link>
      </Box>
      <If when={props.data.recipes.length === 0}>
        {() => (
          <Text id="recipes.empty" font="mono" fontSize="sm" fg="textSecondary">
            No recipes
          </Text>
        )}
      </If>
      <Box as="ul" id="recipes.items" direction="column" gap="hairline" bg="divider" border="hairline" p="0" m="0">
        <For each={props.data.recipes} key="id">
          {(r) => (
            <Box
              as="li"
              id={`recipes.item.${r.id}`}
              direction="row"
              align="baseline"
              justify="between"
              gap="3"
              px="3"
              py="3"
              bg="card"
            >
              <Link id={`recipes.link.${r.id}`} to={routes.href("recipes.show", { recipeId: r.id })} fg="text">
                {r.title}
              </Link>
              <Text
                id={`recipes.minutes.${r.id}`}
                font="mono"
                fontSize="sm"
                fg="textSecondary"
              >{`${r.minutes} min`}</Text>
            </Box>
          )}
        </For>
      </Box>
    </Box>
  );
}
