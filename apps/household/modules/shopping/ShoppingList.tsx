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
    <Box as="section" id="shopping.board" direction="column" gap="4">
      <Menu
        id="shopping.staples"
        trigger={() => <Text>{props.text.addStaple}</Text>}
        items={() => props.text.staples}
        onSelect={(key) => send(shoppingApi.add({ body: { name: staple(key) } }, ctx))}
        styles={{
          trigger: {
            font: "mono",
            fontSize: "sm",
            weight: "medium",
            px: "4",
            py: "2",
            bg: "text",
            fg: "card",
            border: "rule",
            radius: "none",
            states: {
              hover: { bg: "textSecondary", border: "control" },
              focusVisible: { bg: "textSecondary", border: "control" },
              expanded: { bg: "textSecondary" },
            },
          },
          menu: { p: "0", m: "0", bg: "card", border: "rule" },
          item: {
            direction: "row",
            px: "3",
            py: "2",
            states: { highlighted: { bg: "surfaceLow" }, hover: { bg: "surfaceLow" } },
          },
        }}
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
        styles={{
          list: { direction: "row", gap: "2" },
          tab: {
            font: "mono",
            fontSize: "sm",
            px: "3",
            py: "2",
            bg: "surface",
            fg: "textSecondary",
            border: "hairline",
            radius: "none",
            states: { selected: { bg: "card", fg: "text", border: "rule" }, hover: { fg: "text" } },
          },
          panel: { py: "3" },
        }}
        panel={(key) => (
          <Box
            as="ul"
            id={`shopping.rows.${key}`}
            direction="column"
            gap="hairline"
            bg="divider"
            border="hairline"
            p="0"
            m="0"
          >
            <For each={rows(key === "bought")} key="id">
              {(item) => (
                <Box
                  as="li"
                  id={`shopping.row.${item.id}`}
                  direction={{ base: "column", md: "row" }}
                  align={{ base: "start", md: "center" }}
                  justify="between"
                  gap="2"
                  px="3"
                  py="2"
                  bg="card"
                >
                  <Text id={`shopping.name.${item.id}`} fontSize="lg">{`${item.name} × ${item.qty}`}</Text>
                  <Box direction="row" gap="2">
                    <Button
                      id={`shopping.toggle.${item.id}`}
                      onClick={() => send(shoppingApi.toggle({ params: { id: item.id } }, ctx))}
                      font="mono"
                      fontSize="sm"
                      px="3"
                      py="1"
                      bg="card"
                      fg="text"
                      border="rule"
                      radius="none"
                      states={{ hover: { bg: "surfaceLow" }, focusVisible: { bg: "surfaceLow" } }}
                    >
                      {item.bought ? props.text.putBack : props.text.markBought}
                    </Button>
                    <Button
                      id={`shopping.remove.${item.id}`}
                      onClick={() => send(shoppingApi.remove({ params: { id: item.id } }, ctx))}
                      font="mono"
                      fontSize="sm"
                      px="3"
                      py="1"
                      bg="card"
                      fg="error"
                      border="error"
                      radius="none"
                      states={{ hover: { bg: "surfaceLow" }, focusVisible: { bg: "surfaceLow" } }}
                    >
                      {props.text.remove}
                    </Button>
                  </Box>
                </Box>
              )}
            </For>
          </Box>
        )}
      />
      <If when={list.get().length === 0}>
        <Text id="shopping.empty" fg="textSecondary" p="4" bg="card" border="hairline">
          {props.text.empty}
        </Text>
      </If>
      <Box>
        <Toaster
          id="shopping.notices"
          items={() => (failed.get() ? [{ id: "failed", text: props.text.failed, tone: "alert" }] : [])}
          onDismiss={() => failed.set(false)}
          dismiss={props.text.dismiss}
          styles={{
            toast: {
              direction: "row",
              align: "center",
              justify: "between",
              gap: "3",
              px: "3",
              py: "2",
              bg: "card",
              fg: "error",
              border: "error",
              font: "mono",
              fontSize: "sm",
            },
            dismiss: {
              font: "mono",
              fontSize: "sm",
              px: "2",
              py: "1",
              bg: "card",
              fg: "text",
              border: "rule",
              radius: "none",
            },
          }}
        />
      </Box>
      <Box h="hairline" bg="divider" />
      <Disclosure
        id="shopping.help"
        summary={() => <Text>{props.text.help}</Text>}
        styles={{
          button: {
            font: "mono",
            fontSize: "sm",
            px: "0",
            py: "1",
            bg: "surface",
            fg: "text",
            border: "none",
            radius: "none",
            states: { hover: { fg: "textSecondary" } },
          },
          panel: { py: "2", fg: "textSecondary" },
        }}
      >
        <Text id="shopping.help.body">{props.text.helpBody}</Text>
      </Disclosure>
    </Box>
  );
}
