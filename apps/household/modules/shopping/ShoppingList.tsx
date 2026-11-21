import type { Ctx } from "@keel/ctx";
import { signal } from "@keel/reactive";
import { For, If } from "@keel/runtime-dom";
import { type Infer, type Result, s } from "@keel/schema";
import { Disclosure, Menu, Tabs, Toaster } from "@keel/std-headless";
import { tx } from "@keel/store";
import { Box, Button, Text } from "@keel/ui";
import { ListText } from "./ListText.schema.ts";
import { add } from "./add.transaction.ts";
import { items } from "./items.store.ts";
import { remove } from "./remove.transaction.ts";
import { show } from "./show.transaction.ts";
import { toggle } from "./toggle.transaction.ts";

export const Props = s.object({ text: ListText });
export const uses = [add, toggle, remove, show];

export default function ShoppingList(props: Infer<typeof Props>, ctx: Ctx) {
  const failed = signal(false);
  const run = (r: Result<unknown, unknown>) => {
    if (!r.ok) failed.set(true);
  };
  const staple = (key: string) => props.text.staples.find((st) => st.key === key)?.text ?? "";
  const rows = (bought: boolean) => items.get("items").filter((i) => i.bought === bought);
  return (
    <Box as="section" id="shopping.board" gap="3">
      <Menu
        id="shopping.staples"
        trigger={() => <Text>{props.text.addStaple}</Text>}
        items={() => props.text.staples}
        onSelect={(key) => run(tx(add, { id: ctx.random.id("Item"), name: staple(key) }))}
      />
      <Tabs
        id="shopping.view"
        label={props.text.views}
        tabs={() => [
          { key: "toBuy", text: props.text.toBuy },
          { key: "bought", text: props.text.bought },
        ]}
        selected={() => items.get("show")}
        onChange={(key) => run(tx(show, { show: key }))}
        panel={(key) => (
          <Box as="ul" id={`shopping.rows.${key}`} gap="2">
            <For each={rows(key === "bought")} key="id">
              {(item) => (
                <Box as="li" id={`shopping.row.${item.id}`} direction="row" gap="2" align="center">
                  <Text id={`shopping.name.${item.id}`}>{`${item.name} × ${item.qty}`}</Text>
                  <Button id={`shopping.toggle.${item.id}`} onClick={() => run(tx(toggle, { id: item.id }))}>
                    {item.bought ? props.text.putBack : props.text.markBought}
                  </Button>
                  <Button id={`shopping.remove.${item.id}`} onClick={() => run(tx(remove, { id: item.id }))}>
                    {props.text.remove}
                  </Button>
                </Box>
              )}
            </For>
          </Box>
        )}
      />
      <If when={items.get("items").length === 0}>
        <Text id="shopping.empty">{props.text.empty}</Text>
      </If>
      <Toaster
        id="shopping.notices"
        items={() => (failed.get() ? [{ id: "failed", text: props.text.failed, tone: "alert" }] : [])}
        onDismiss={() => failed.set(false)}
        dismiss={props.text.dismiss}
      />
      <Disclosure id="shopping.help" summary={() => <Text>{props.text.help}</Text>}>
        <Text id="shopping.help.body">{props.text.helpBody}</Text>
      </Disclosure>
    </Box>
  );
}
