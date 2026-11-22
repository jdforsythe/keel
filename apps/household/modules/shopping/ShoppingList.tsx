import type { Ctx } from "@keel/ctx";
import { signal } from "@keel/reactive";
import { For, If } from "@keel/runtime-dom";
import { type Infer, type Result, s } from "@keel/schema";
import { Disclosure, Menu, Tabs, Toaster } from "@keel/std-headless";
import { type LiveStatus, live } from "@keel/std-live";
import { tx } from "@keel/store";
import { Box, Button, Text } from "@keel/ui";
import { Item } from "./Item.schema.ts";
import type { Items } from "./Items.schema.ts";
import { ListText } from "./ListText.schema.ts";
import { copy } from "./copy.store.ts";
import { hydrate } from "./hydrate.transaction.ts";
import { listChannel } from "./listChannel.schema.ts";
import { pageOrigin } from "./pageOrigin.ts";
import { shoppingApi } from "./shoppingApi.ts";
import { show } from "./show.transaction.ts";
import { view } from "./view.store.ts";

export const Props = s.object({ text: ListText, items: s.array(Item) });
export const uses = [show, hydrate];

export default function ShoppingList(props: Infer<typeof Props>, ctx: Ctx) {
  const failed = signal(false);
  const run = (r: Result<unknown, unknown>) => {
    if (!r.ok) failed.set(true);
  };
  // Every member's page follows the list channel: after each change, its own included, it re-reads the list through
  // its own API call into `shopping.copy`. The server render has no stream; the page's own data shows until the
  // first read commits.
  // A stream keeps the member it opened with, so after a sign-out elsewhere it still hears each change; the re-read is
  // then refused, and the page says it is signed out rather than connecting.
  const origin = pageOrigin();
  const signedOut = signal(false);
  const read = async (c: Ctx, abort: AbortSignal) => {
    const r = await shoppingApi.items({ signal: abort }, c);
    signedOut.set(!r.ok && r.error.code === "api.status" && r.error.data.status === 403);
    return r;
  };
  const following =
    origin === undefined ? (): LiveStatus => "connecting" : live(ctx, origin, listChannel, {}, { read, hydrate });
  const status = (): LiveStatus => (signedOut.get() ? "denied" : following());
  const send = async (call: Promise<Result<Infer<typeof Items>, unknown>>) => {
    const r = await call;
    if (r.ok) run(tx(hydrate, r.value));
    else failed.set(true);
  };
  const list = () => (copy.get("read") ? copy.get("items") : props.items);
  const staple = (key: string) => props.text.staples.find((st) => st.key === key)?.text ?? "";
  const rows = (bought: boolean) => list().filter((i) => i.bought === bought);
  return (
    <Box as="section" id="shopping.board" direction="column" gap="4">
      <Box direction="row">
        <Text
          id="shopping.live"
          role="status"
          font="mono"
          fontSize="xs"
          px="2"
          py="1"
          bg="card"
          fg={status() === "live" ? "verified" : status() === "offline" ? "error" : "textSecondary"}
          border={status() === "live" ? "verified" : status() === "offline" ? "error" : "accent"}
        >
          {props.text.live[status()]}
        </Text>
      </Box>
      <Menu
        id="shopping.staples"
        trigger={() => <Text>{props.text.addStaple}</Text>}
        items={() => props.text.staples}
        onSelect={(key) => send(shoppingApi.add({ body: { name: staple(key) } }, ctx))}
        styles={{
          trigger: { look: "primary", states: { expanded: { bg: "textSecondary" } } },
          menu: { direction: "column", p: "0", m: "0", bg: "card", border: "rule" },
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
                      look="secondary"
                    >
                      {item.bought ? props.text.putBack : props.text.markBought}
                    </Button>
                    <Button
                      id={`shopping.remove.${item.id}`}
                      onClick={() => send(shoppingApi.remove({ params: { id: item.id } }, ctx))}
                      look="secondary"
                      fg="error"
                      border="error"
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
      <If when={list().length === 0}>
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
              look: "notice",
              direction: "row",
              align: "center",
              justify: "between",
              gap: "3",
              fg: "error",
              border: "error",
            },
            dismiss: { look: "secondary" },
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
