import { For, If } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { formatMessage } from "@keel/std-messages";
import { formatMoney } from "@keel/std-money";
import { durationOf, formatDate, formatDuration } from "@keel/std-temporal";
import { Box, Heading, Link, Text } from "@keel/ui";
import { IndexData } from "./IndexData.schema.ts";
import { LocaleParams } from "./LocaleParams.schema.ts";
import { RecipeSearch } from "./RecipeSearch.schema.ts";
import { routes } from "./routes.ts";

export const Props = s.object({ params: LocaleParams, search: RecipeSearch, data: IndexData });

/** Route `recipes.index`: the recipes (or only favorites) with count, price, date and time, and filter links. */
export default function RecipeList(props: Infer<typeof Props>) {
  return (
    <Box as="section" id="recipes.list" direction="column" gap="5">
      <Heading id="recipes.list.title" level={1} fontSize="2xl" weight="semibold" m="0">
        {props.data.text.listTitle}
      </Heading>
      <Box direction="row" align="baseline" justify="between" gap="4" font="mono" fontSize="sm">
        <Box as="nav" id="recipes.filters" direction="row" gap="4">
          <Link
            id="recipes.filter.all"
            to={routes.href("recipes.index", { locale: props.params.locale }, { only: "all" })}
            fg="text"
          >
            {props.data.text.filterAll}
          </Link>
          <Link
            id="recipes.filter.favorites"
            to={routes.href("recipes.index", { locale: props.params.locale }, { only: "favorites" })}
            fg="text"
          >
            {props.data.text.filterFavorites}
          </Link>
        </Box>
        <Text id="recipes.count" fg="textSecondary">
          {formatMessage(props.data.text.count, { n: props.data.recipes.length }, props.params.locale)}
        </Text>
      </Box>
      <If when={props.data.recipes.length === 0}>
        {() => (
          <Text id="recipes.empty" font="mono" fontSize="sm" fg="textSecondary">
            {props.data.text.empty}
          </Text>
        )}
      </If>
      <Box as="ul" id="recipes.items" direction="column" gap="hairline" bg="divider" border="hairline" p="0" m="0">
        <For each={props.data.recipes} key="id">
          {(r) => (
            <Box
              as="li"
              id={`recipes.item.${r.id}`}
              direction={{ base: "column", md: "row" }}
              align={{ base: "start", md: "baseline" }}
              justify="between"
              gap="3"
              px="3"
              py="3"
              bg="card"
            >
              <Link
                id={`recipes.link.${r.id}`}
                to={routes.href("recipes.show", { locale: props.params.locale, recipeId: r.id })}
                fg="text"
              >
                {r.title}
              </Link>
              <Box direction="row" gap="4" font="mono" fontSize="sm" fg="textSecondary">
                <Text id={`recipes.price.${r.id}`}>{formatMoney(r.price, props.params.locale)}</Text>
                <Text id={`recipes.minutes.${r.id}`}>
                  {formatDuration(durationOf(r.minutes * 60_000), props.params.locale, "short")}
                </Text>
                <Text id={`recipes.added.${r.id}`}>{formatDate(r.addedOn, props.params.locale, "long")}</Text>
              </Box>
            </Box>
          )}
        </For>
      </Box>
    </Box>
  );
}
