import { Box, Heading, Text } from "@keel/ui";

const fmt = (word: string): string => word;

/** A module listing `@keel/std-messages` whose copy follows std.copy: it comes from `props`, a call or a number, never a literal. */
export default function RecipeList(props: { data: { text: { title: string } }; n: number }) {
  return (
    <Box as="section" id="recipes.list" direction="column">
      <Heading id="recipes.list.title" level={1}>
        {props.data.text.title}
      </Heading>
      <Text id="recipes.list.count">{props.n + 1}</Text>
      <Text id="recipes.list.unit">{"%"}</Text>
      <Text id="recipes.list.fmt">{fmt("Recipes")}</Text>
    </Box>
  );
}
