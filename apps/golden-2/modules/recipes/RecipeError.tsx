import { type Infer, s } from "@keel/schema";
import { Box, Heading, Text } from "@keel/ui";
import { RecipeNotFound } from "./RecipeNotFound.schema.ts";
import { notFoundText } from "./notFoundText.ts";

// The heading is the section's accessible name, so it is never empty (WCAG 2.4.6: a heading names its section).
export const Props = s.object({
  error: s.object({
    code: s.string(),
    message: s.string({ min: 1 }),
    cause: s.object({ code: s.string(), message: s.string() }).optional(),
  }),
});

/**
 * `errorElement` of `recipes.show`: it gets no params, so a missing recipe's heading is the `notFound` text of the
 * locale its `recipes.notFound` cause holds; any other error's heading is its message.
 */
export default function RecipeError(props: Infer<typeof Props>) {
  const missing = RecipeNotFound.parse(props.error.cause);
  return (
    <Box as="section" id="recipes.errorBox" direction="column" gap="3" p="4" bg="card" border="error">
      <Text id="recipes.error.code" font="mono" fontSize="xs" fg="accent">
        {props.error.code}
      </Text>
      <Heading id="recipes.error" level={1} fontSize="2xl" m="0" fg="error">
        {missing.ok ? notFoundText(missing.value.data.locale) : props.error.message}
      </Heading>
    </Box>
  );
}
