import { type Infer, s } from "@keel/schema";
import { Box, Heading, Text } from "@keel/ui";

export const Props = s.object({
  error: s.object({ code: s.string(), message: s.string() }),
});

/** `errorElement` of `recipes.show`. */
export default function RecipeError(props: Infer<typeof Props>) {
  return (
    <Box as="section" id="recipes.errorBox" direction="column" gap="3" p="4" bg="card" border="error">
      <Text font="mono" fontSize="xs" fg="accent">
        {props.error.code}
      </Text>
      <Heading id="recipes.error.heading" level={1} fontSize="2xl" weight="semibold" m="0" fg="error">
        Something went wrong
      </Heading>
      <Text id="recipes.error" font="mono" fontSize="sm" fg="error">
        {props.error.message}
      </Text>
    </Box>
  );
}
