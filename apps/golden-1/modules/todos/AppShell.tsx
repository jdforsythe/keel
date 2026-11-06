import { computed } from "@keel/reactive";
import { href } from "@keel/router";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Link } from "@keel/ui";
import { board } from "./board.ts";

export const Props = s.object({});

/** Layout `todos.shell`: home link, Undo (disabled while the board log is empty), and the page in `main`. */
export default function AppShell(props: Infer<typeof Props> & { readonly children?: Node }) {
  const empty = computed(() => board.log().length === 0);
  // The router hands a layout its page as a Node; a `children()` binding inserts it as a node (compiler D31).
  const children = (): Node | string => props.children ?? "";
  return (
    <Box id="todos.shell" p="3" gap="2" bg="bg" fg="fg">
      <Box as="nav" id="todos.nav" direction="row" gap="2">
        <Link id="todos.home" to={href("todos.index")}>
          Home
        </Link>
        <Button id="todos.undo" label="Undo" disabled={empty} />
      </Box>
      <Box as="main" id="todos.main">
        {children()}
      </Box>
    </Box>
  );
}
AppShell.Props = Props;
