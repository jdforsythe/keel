import type { Ctx } from "@keel/ctx";
import { For, If } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { type OutboxEntry, type Resolution, resolve } from "@keel/std-offline";
import { Box, Button, Heading, Text } from "@keel/ui";
import { boardOutbox } from "./boardOutbox.ts";
import { editorStuck } from "./editorStuck.ts";
import { idPart } from "./idPart.ts";
import { resolveEdit } from "./resolveEdit.ts";

export const Props = s.object({});

const WRITES: { readonly [endpoint: string]: string } = {
  createList: "Add list",
  addTodo: "Add todo",
  toggleTodo: "Mark todo",
  editTodo: "Edit todo",
};

const STATES: { readonly [K in OutboxEntry["state"]]: string } = {
  queued: "Waiting to send",
  sending: "Sending",
  conflict: "Someone changed this board first",
  failed: "Not saved",
};

/**
 * The outbox panel (`todos.outbox`, shown while the outbox holds a write): each waiting, refused or failed board
 * write in the order sent. A refused write offers Keep mine (send it again over the newer board) and Keep theirs
 * (drop it); a failed one offers Dismiss. An edit's choice goes through the editor chart (`resolveEdit`), which turns
 * Keep mine off once the edit has used its 3 tries.
 */
export default function OutboxPanel(_props: Infer<typeof Props>, ctx: Ctx) {
  const choose = (entry: OutboxEntry, resolution: Resolution): void => {
    if (entry.endpoint === "editTodo") void resolveEdit(ctx, entry.key, resolution);
    else void resolve(ctx, boardOutbox, entry.key, resolution);
  };
  return (
    <If when={boardOutbox.get("entries").length > 0}>
      {() => (
        <Box
          as="aside"
          id="todos.outbox"
          label="Outbox"
          direction="column"
          gap="3"
          w={{ md: "measure" }}
          mx={{ md: "auto" }}
          px={{ base: "3", md: "4" }}
          py="4"
        >
          <Heading id="todos.outbox.title" level={2} fontSize="xl" weight="semibold" m="0">
            Outbox
          </Heading>
          <Box
            as="ul"
            id="todos.outbox.items"
            direction="column"
            gap="hairline"
            bg="divider"
            border="hairline"
            p="0"
            m="0"
          >
            <For each={boardOutbox.get("entries")} key="key">
              {(entry) => (
                <Box
                  as="li"
                  id={`todos.outbox.entry.${idPart(entry.key)}`}
                  direction="row"
                  align="center"
                  justify="between"
                  gap="3"
                  px="3"
                  py="2"
                  bg="card"
                >
                  <Text id={`todos.outbox.write.${idPart(entry.key)}`} font="mono" fontSize="sm">
                    {WRITES[entry.endpoint] ?? entry.endpoint}
                  </Text>
                  <Text
                    id={`todos.outbox.state.${idPart(entry.key)}`}
                    font="mono"
                    fontSize="xs"
                    px="2"
                    py="1"
                    fg={entry.state === "queued" || entry.state === "sending" ? "textSecondary" : "error"}
                    border={entry.state === "queued" || entry.state === "sending" ? "hairline" : "error"}
                  >
                    {STATES[entry.state]}
                  </Text>
                  <If when={entry.state === "conflict"}>
                    {() => (
                      <Box direction="row" gap="2">
                        <Button
                          id={`todos.outbox.mine.${idPart(entry.key)}`}
                          disabled={entry.endpoint === "editTodo" && editorStuck()}
                          onClick={() => choose(entry, "mine")}
                          font="mono"
                          fontSize="sm"
                          px="3"
                          py="2"
                          bg="text"
                          fg="card"
                          border="rule"
                          radius="none"
                        >
                          Keep mine
                        </Button>
                        <Button
                          id={`todos.outbox.theirs.${idPart(entry.key)}`}
                          onClick={() => choose(entry, "theirs")}
                          font="mono"
                          fontSize="sm"
                          px="3"
                          py="2"
                          bg="card"
                          fg="text"
                          border="rule"
                          radius="none"
                        >
                          Keep theirs
                        </Button>
                      </Box>
                    )}
                  </If>
                  <If when={entry.state === "failed"}>
                    {() => (
                      <Button
                        id={`todos.outbox.theirs.${idPart(entry.key)}`}
                        onClick={() => choose(entry, "theirs")}
                        font="mono"
                        fontSize="sm"
                        px="3"
                        py="2"
                        bg="card"
                        fg="text"
                        border="rule"
                        radius="none"
                      >
                        Dismiss
                      </Button>
                    )}
                  </If>
                </Box>
              )}
            </For>
          </Box>
        </Box>
      )}
    </If>
  );
}
