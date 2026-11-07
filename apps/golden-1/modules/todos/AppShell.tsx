import type { Ctx } from "@keel/ctx";
import { computed } from "@keel/reactive";
import { href } from "@keel/router";
import type { Slots } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Link } from "@keel/ui";
import { hydrate } from "./hydrate.ts";
import { refreshView } from "./refreshView.ts";
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
      void todosApi()
        .undo({}, ctx)
        .then(() => refreshView(ctx));
  };
  return (
    <Box id="todos.shell" p="3" gap="2" bg="bg" fg="fg">
      <Box as="nav" id="todos.nav" direction="row" gap="2">
        <Link id="todos.home" to={href("todos.index")}>
          Home
        </Link>
        <Button id="todos.undo" label="Undo" disabled={empty} onClick={undo} />
      </Box>
      <Box as="main" id="todos.main">
        {props.children?.()}
      </Box>
    </Box>
  );
}
