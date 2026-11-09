import type { Ctx } from "@keel/ctx";
import { computed } from "@keel/reactive";
import type { Slots } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Image, Link, Text } from "@keel/ui";
import { hydrate } from "./hydrate.ts";
import { refreshView } from "./refreshView.ts";
import { routes } from "./routes.ts";
import { todosApi } from "./todosApi.ts";
import { view } from "./view.ts";

export const Props = s.object({});
export const uses = [hydrate];

/**
 * Layout `todos.shell`: home link, Undo, and the page in `main`. Undo posts `/api/undo` (the `api` deployable owns
 * the log and undoes only this client's own last write) and re-reads the board even when refused (another client
 * wrote last), so `canUndo` turns it off; it is disabled while the served board says there is nothing to undo.
 */
export default function AppShell(
  props: Infer<typeof Props> & { readonly children?: () => Node },
  _slots?: Slots,
  ctx?: Ctx,
) {
  const empty = computed(() => !view.get("canUndo"));
  const undo = (): void => {
    if (ctx !== undefined)
      void todosApi(location.origin)
        .undo({}, ctx)
        .then(() => refreshView(location.origin, ctx));
  };
  return (
    <Box id="todos.shell" direction="column" bg="surface" fg="text" font="serif" fontSize="md">
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
          <Image src="/keel-mark.svg" decorative h="mark" />
          <Text fontSize="lg" weight="semibold">
            Keel
          </Text>
          <Text font="mono" fontSize="xs" fg="textSecondary">
            golden-1 / todos
          </Text>
        </Box>
        <Box as="nav" id="todos.nav" direction="row" align="center" gap="4">
          <Link id="todos.home" to={routes.href("todos.index")} fg="text">
            Home
          </Link>
          <Button
            id="todos.undo"
            disabled={empty}
            onClick={undo}
            font="mono"
            fontSize="sm"
            px="3"
            py="2"
            bg="card"
            fg="text"
            border="rule"
            radius="none"
            states={{ hover: { bg: "surfaceLow" }, disabled: { fg: "textSecondary", border: "control" } }}
          >
            Undo
          </Button>
        </Box>
      </Box>
      <Box h="hairline" bg="divider" />
      <Box as="main" id="todos.main" w={{ md: "measure" }} mx={{ md: "auto" }} px={{ base: "3", md: "4" }} py="6">
        {props.children?.()}
      </Box>
    </Box>
  );
}
