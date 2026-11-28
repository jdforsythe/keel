import type { Ctx } from "@keel/ctx";
import { For, If } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { type OutboxEntry, resolve } from "@keel/std-offline";
import { tx } from "@keel/store";
import { Box, Button, Heading, Text } from "@keel/ui";
import { Item } from "./Item.schema.ts";
import { Items } from "./Items.schema.ts";
import { OutboxText } from "./OutboxText.schema.ts";
import { Refusal } from "./Refusal.schema.ts";
import { hydrate } from "./hydrate.transaction.ts";
import { listOutbox } from "./listOutbox.ts";
import { markOf } from "./markOf.ts";

export const Props = s.object({ text: OutboxText, items: s.array(Item) });
export const uses = [hydrate];

/** Why a failed entry failed: its item is gone (the API answered 404), another member queued it, or anything else. */
const reasonOf = (entry: OutboxEntry): "gone" | "otherMember" | "refused" => {
  const error = Refusal.parse(entry.error);
  if (!error.ok) return "refused";
  if (error.value.data.status === 404) return "gone";
  return error.value.code === "offline.owner" ? "otherMember" : "refused";
};

/**
 * The marks the server did not take (`shopping.outbox.refused`, shown while there is one). A mark whose item changed
 * at home first names the item as it is now and offers to apply the mark over it or to leave the item as it is. A mark
 * of an item no longer on the list, one another member queued on this device, and any other refusal each say so and
 * offer Dismiss.
 */
export default function OutboxNote(props: Infer<typeof Props>, ctx: Ctx) {
  const refused = () => listOutbox.get("entries").filter((e) => e.state === "conflict" || e.state === "failed");
  const item = (entry: OutboxEntry) => props.items.find((i) => i.id === markOf(entry)?.id);
  const name = (entry: OutboxEntry) => {
    const now = item(entry);
    return now === undefined ? props.text.goneItem : `${now.name} × ${now.qty}`;
  };
  const why = (entry: OutboxEntry) => {
    if (entry.state === "conflict") return props.text.conflict;
    return props.text[reasonOf(entry)];
  };
  const mine = async (entry: OutboxEntry) => {
    const r = await resolve(ctx, listOutbox, entry.key, "mine");
    const items = r !== false && r.state === "sent" ? Items.parse(r.value) : undefined;
    // A list the page cannot take is left: the next live read replaces the copy.
    if (items?.ok === true && !tx(hydrate, items.value).ok) return;
  };
  return (
    <If when={refused().length > 0}>
      {() => (
        <Box as="aside" id="shopping.outbox.refused" label={props.text.heading} look="panel">
          <Heading id="shopping.outbox.heading" level={2} fontSize="lg">
            {props.text.heading}
          </Heading>
          <Box as="ul" id="shopping.outbox.entries" direction="column" gap="3" p="0" m="0">
            <For each={refused()} key="key">
              {(entry) => (
                <Box as="li" id={`shopping.outbox.entry.${entry.key}`} direction="column" gap="2">
                  <Text id={`shopping.outbox.why.${entry.key}`} role="alert" fg="error">
                    {`${name(entry)}: ${why(entry)}`}
                  </Text>
                  <Box direction="row" wrap="wrap" gap="2">
                    <If when={entry.state === "conflict"}>
                      {() => (
                        <Button id={`shopping.outbox.mine.${entry.key}`} onClick={() => mine(entry)}>
                          {markOf(entry)?.bought === false ? props.text.mineBack : props.text.mineBought}
                        </Button>
                      )}
                    </If>
                    <Button
                      id={`shopping.outbox.theirs.${entry.key}`}
                      onClick={() => resolve(ctx, listOutbox, entry.key, "theirs")}
                      look="secondary"
                    >
                      {entry.state === "conflict" ? props.text.theirs : props.text.dismiss}
                    </Button>
                  </Box>
                </Box>
              )}
            </For>
          </Box>
        </Box>
      )}
    </If>
  );
}
