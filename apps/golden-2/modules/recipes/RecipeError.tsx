import { type Infer, s } from "@keel/schema";
import { Box, Heading, Text } from "@keel/ui";

export const Props = s.object({
  error: s.object({ code: s.string(), message: s.string() }),
});

/** `errorElement` of `recipes.show`. */
export default function RecipeError(props: Infer<typeof Props>) {
  return (
    <Box as="section" id="recipes.errorBox" gap="2">
      <Heading id="recipes.error.heading" level={1} fg="danger">
        Something went wrong
      </Heading>
      <Text id="recipes.error" fg="danger">
        {props.error.message}
      </Text>
    </Box>
  );
}
