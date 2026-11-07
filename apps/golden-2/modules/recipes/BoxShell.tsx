import { type Infer, s } from "@keel/schema";
import { Box, Link } from "@keel/ui";
import { routes } from "./routes.ts";

export const Props = s.object({});

/** Layout `recipes.shell`: navigation links and the page in `main`. */
export default function BoxShell(props: Infer<typeof Props> & { readonly children?: () => Node }) {
  return (
    <Box id="recipes.shell" p="3" gap="2" bg="bg" fg="fg">
      <Box as="nav" id="recipes.nav" direction="row" gap="2">
        <Link id="recipes.home" to={routes.href("recipes.index")}>
          Recipes
        </Link>
        <Link id="recipes.newLink" to={routes.href("recipes.new")}>
          New recipe
        </Link>
      </Box>
      <Box as="main" id="recipes.main">
        {props.children?.()}
      </Box>
    </Box>
  );
}
