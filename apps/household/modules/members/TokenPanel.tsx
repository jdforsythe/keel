import type { Ctx } from "@keel/ctx";
import { signal } from "@keel/reactive";
import { For, If } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { formatDate } from "@keel/std-temporal";
import { Box, Button, Heading, Text } from "@keel/ui";
import { ProfileText } from "./ProfileText.schema.ts";
import { TokenInfo } from "./TokenInfo.schema.ts";
import { membersApi } from "./membersApi.ts";

export const Props = s.object({ text: ProfileText, tokens: s.array(TokenInfo) });

/**
 * The member's API tokens: one button makes a token that works for 30 days and shows its text this once; each listed
 * token has a button that revokes it. Every call goes through the members API and shows the list it answers. Rows are
 * numbered by position: a token id is the library's text, not an element id.
 */
export default function TokenPanel(props: Infer<typeof Props>, ctx: Ctx) {
  const list = signal(props.tokens);
  const shown = signal("");
  const failed = signal(false);
  // A token is one unbroken word; in pieces of 16 the row wraps at phone width and the text still copies whole.
  const pieces = (token: string) =>
    Array.from({ length: Math.ceil(token.length / 16) }, (_, n) => ({ at: n, text: token.slice(n * 16, n * 16 + 16) }));
  const mint = async () => {
    const r = await membersApi.mint({ body: { days: 30 } }, ctx);
    if (!r.ok) return failed.set(true);
    shown.set(r.value.token);
    const again = await membersApi.tokens({}, ctx);
    if (again.ok) list.set(again.value.tokens);
  };
  const revoke = async (id: string) => {
    const r = await membersApi.revoke({ params: { id } }, ctx);
    if (r.ok) list.set(r.value.tokens);
    else failed.set(true);
  };
  return (
    <Box as="section" id="members.tokens" direction="column" gap="3">
      <Box h="hairline" bg="divider" />
      <Heading id="members.tokens.heading" level={2} m="0" fontSize="lg" weight="semibold">
        {props.text.tokensHeading}
      </Heading>
      <Text id="members.tokens.intro" fg="textSecondary">
        {props.text.tokensIntro}
      </Text>
      <Box direction="row">
        <Button
          id="members.mint"
          onClick={mint}
          font="mono"
          fontSize="sm"
          px="3"
          py="2"
          bg="card"
          fg="text"
          border="rule"
          radius="none"
          states={{ hover: { bg: "surfaceLow" }, focusVisible: { bg: "surfaceLow" } }}
        >
          {props.text.mint}
        </Button>
      </Box>
      <If when={shown.get() !== ""}>
        <Box direction="column" gap="2" p="3" bg="card" border="rule">
          <Text id="members.minted.note" fontSize="sm">
            {props.text.minted}
          </Text>
          <Box id="members.minted" direction="row" wrap="wrap" p="2" bg="surfaceLow" font="mono" fontSize="sm">
            <For each={pieces(shown.get())} key="at">
              {(piece) => <Text>{piece.text}</Text>}
            </For>
          </Box>
        </Box>
      </If>
      <If when={failed.get()}>
        <Text id="members.tokens.failed" fg="error" bg="card" border="error" px="3" py="2" font="mono" fontSize="sm">
          {props.text.failed}
        </Text>
      </If>
      <If when={list.get().length === 0}>
        <Text id="members.tokens.none" fg="textSecondary" p="3" bg="card" border="hairline">
          {props.text.noTokens}
        </Text>
      </If>
      <Box as="ul" id="members.tokens.list" direction="column" gap="hairline" bg="divider" p="0" m="0">
        <For each={list.get().map((t, n) => ({ ...t, n }))} key="id">
          {(t) => (
            <Box
              as="li"
              id={`members.token.${t.n}`}
              direction="row"
              wrap="wrap"
              justify="between"
              align="center"
              gap="2"
              px="3"
              py="2"
              bg="card"
            >
              <Text id={`members.token.ends.${t.n}`} font="mono" fontSize="sm">
                {`${props.text.expires} ${formatDate(t.expiresOn, "en-US", "long")}`}
              </Text>
              <Button
                id={`members.revoke.${t.n}`}
                onClick={() => revoke(t.id)}
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
                {props.text.revoke}
              </Button>
            </Box>
          )}
        </For>
      </Box>
    </Box>
  );
}
