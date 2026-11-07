import { type Infer, s } from "@keel/schema";
import { Box, Image, Link, Text } from "@keel/ui";
import { routes } from "./routes.ts";

export const Props = s.object({});

/** Layout `recipes.shell`: navigation links and the page in `main`. */
export default function BoxShell(props: Infer<typeof Props> & { readonly children?: () => Node }) {
  return (
    <Box id="recipes.shell" direction="column" bg="surface" fg="text" font="serif" fontSize="md">
      <Box
        as="header"
        direction={{ base: "column", md: "row" }}
        align={{ base: "start", md: "center" }}
        justify="between"
        gap="3"
        px={{ base: "3", md: "6" }}
        py="4"
      >
        <Box direction="row" align="center" gap="3">
          <Image src="/keel-mark.svg" decorative w="mark" h="mark" />
          <Text fontSize="lg" weight="semibold">
            Keel
          </Text>
          <Text font="mono" fontSize="xs" fg="textSecondary">
            golden-2 / recipes
          </Text>
        </Box>
        <Box as="nav" id="recipes.nav" direction="row" align="center" gap="4">
          <Link id="recipes.home" to={routes.href("recipes.index")} fg="text">
            Recipes
          </Link>
          <Link id="recipes.newLink" to={routes.href("recipes.new")} fg="text">
            New recipe
          </Link>
        </Box>
      </Box>
      <Box h="hairline" bg="divider" />
      <Box as="main" id="recipes.main" w={{ md: "measure" }} mx={{ md: "auto" }} px={{ base: "3", md: "4" }} py="6">
        {props.children?.()}
      </Box>
    </Box>
  );
}
