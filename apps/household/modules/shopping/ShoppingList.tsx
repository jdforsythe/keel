import type { Ctx } from "@keel/ctx";
import { signal } from "@keel/reactive";
import { For, If } from "@keel/runtime-dom";
import { type Infer, type Result, s } from "@keel/schema";
import { Disclosure, Menu, Tabs, Toaster } from "@keel/std-headless";
import { tx } from "@keel/store";
import { Box, Button, Text } from "@keel/ui";
import { Item } from "./Item.schema.ts";
import type { Items } from "./Items.schema.ts";
import { ListText } from "./ListText.schema.ts";
import { shoppingApi } from "./shoppingApi.ts";
import { show } from "./show.transaction.ts";
import { view } from "./view.store.ts";

export const Props = s.object({ text: ListText, items: s.array(Item) });
export const uses = [show];

export default function ShoppingList(props: Infer<typeof Props>, ctx: Ctx) {
  const failed = signal(false);
  const run = (r: Result<unknown, unknown>) => {
    if (!r.ok) failed.set(true);
  };
  const list = signal(props.items);
  const send = async (call: Promise<Result<Infer<typeof Items>, unknown>>) => {
    const r = await call;
    if (r.ok) list.set(r.value.items);
    else failed.set(true);
  };
  const staple = (key: string) => props.text.staples.find((st) => st.key === key)?.text ?? "";
  const rows = (bought: boolean) => list.get().filter((i) => i.bought === bought);
  return (
    <Box as="section" id="shopping.board" gap="3">
      <Menu
        id="shopping.staples"
        trigger={() => <Text>{props.text.addStaple}</Text>}
        items={() => props.text.staples}
        onSelect={(key) => send(shoppingApi.add({ body: { name: staple(key) } }, ctx))}
      />
      <Tabs
        id="shopping.view"
        label={props.text.views}
        tabs={() => [
          { key: "toBuy", text: props.text.toBuy },
          { key: "bought", text: props.text.bought },
        ]}
        selected={() => view.get("show")}
        onChange={(key) => run(tx(show, { show: key }))}
        panel={(key) => (
          <Box as="ul" id={`shopping.rows.${key}`} gap="2">
            <For each={rows(key === "bought")} key="id">
              {(item) => (
                <Box as="li" id={`shopping.row.${item.id}`} direction="row" gap="2" align="center">
                  <Text id={`shopping.name.${item.id}`}>{`${item.name} × ${item.qty}`}</Text>
                  <Button
                    id={`shopping.toggle.${item.id}`}
                    onClick={() => send(shoppingApi.toggle({ params: { id: item.id } }, ctx))}
                  >
                    {item.bought ? props.text.putBack : props.text.markBought}
                  </Button>
                  <Button
                    id={`shopping.remove.${item.id}`}
                    onClick={() => send(shoppingApi.remove({ params: { id: item.id } }, ctx))}
                  >
                    {props.text.remove}
                  </Button>
                </Box>
              )}
            </For>
          </Box>
        )}
      />
      <If when={list.get().length === 0}>
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
