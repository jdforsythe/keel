import { type Infer, s } from "@keel/schema";
import { Box, Heading, Text } from "@keel/ui";

export const Props = s.object({
  error: s.object({ code: s.string(), message: s.string() }),
});

/** `errorElement` of `recipes.show`: it gets no params, so its heading is the message the loader wrote in its locale. */
export default function RecipeError(props: Infer<typeof Props>) {
  return (
    <Box as="section" id="recipes.errorBox" direction="column" gap="3" p="4" bg="card" border="error">
      <Text id="recipes.error.code" font="mono" fontSize="xs" fg="accent">
        {props.error.code}
      </Text>
      <Heading id="recipes.error" level={1} fontSize="2xl" weight="semibold" m="0" fg="error">
        {props.error.message}
      </Heading>
    </Box>
  );
}
