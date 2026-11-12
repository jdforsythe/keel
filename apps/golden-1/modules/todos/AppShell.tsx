import type { Ctx } from "@keel/ctx";
import { computed } from "@keel/reactive";
import type { Slots } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { type LiveStatus, live } from "@keel/std-live";
import { drain } from "@keel/std-offline";
import { Box, Button, Image, Link, Text } from "@keel/ui";
import { boardChannel } from "../api/boardChannel.ts";
import OutboxPanel from "./OutboxPanel.tsx";
import { boardOutbox } from "./boardOutbox.ts";
import { hydrate } from "./hydrate.ts";
import { pageOrigin } from "./pageOrigin.ts";
import { refreshView } from "./refreshView.ts";
import { routes } from "./routes.ts";
import { todosApi } from "./todosApi.ts";
import { view } from "./view.ts";

export const Props = s.object({});
export const uses = [hydrate];

const LABELS: { readonly [K in LiveStatus]: string } = {
  live: "Live",
  connecting: "Connecting",
  offline: "Offline",
  denied: "No access",
};

/**
 * Layout `todos.shell`: home link, Undo, the board's live status, the outbox panel and the page in `main`. On a page it
 * follows the board channel (`live`): after every save, its own included, it re-reads the board into `todos.view`;
 * and it sends the outbox's waiting writes, again on each reconnect (`drain`). Undo posts `/api/undo` (the `api`
 * deployable owns the log and undoes only this client's own last write) and re-reads the board even when refused
 * (another client wrote last), so `canUndo` turns it off; it is disabled while the served board says there is
 * nothing to undo.
 */
export default function AppShell(
  props: Infer<typeof Props> & { readonly children?: () => Node },
  _slots?: Slots,
  ctx?: Ctx,
) {
  const origin = pageOrigin();
  const status =
    ctx === undefined || origin === undefined
      ? (): LiveStatus => "connecting"
      : live(ctx, origin, boardChannel, {}, { read: (c) => todosApi.lists({}, c), hydrate });
  if (ctx !== undefined && origin !== undefined) void drain(ctx, boardOutbox);
  const empty = computed(() => !view.get("canUndo"));
  const undo = (): void => {
    if (ctx !== undefined) void todosApi.undo({}, ctx).then(() => refreshView(ctx));
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
        <Box as="nav" id="todos.nav" label="Main" direction="row" align="center" gap="4">
          <Text
            id="todos.live"
            font="mono"
            fontSize="xs"
            px="2"
            py="1"
            fg={status() === "live" ? "verified" : status() === "offline" ? "error" : "textSecondary"}
            border={status() === "live" ? "verified" : status() === "offline" ? "error" : "hairline"}
          >
            {LABELS[status()]}
          </Text>
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
      <OutboxPanel />
      <Box as="main" id="todos.main" w={{ md: "measure" }} mx={{ md: "auto" }} px={{ base: "3", md: "4" }} py="6">
        {props.children?.()}
      </Box>
    </Box>
  );
}
