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
      <Heading id="members.tokens.heading" level={2} fontSize="lg">
        {props.text.tokensHeading}
      </Heading>
      <Text id="members.tokens.intro" fg="textSecondary">
        {props.text.tokensIntro}
      </Text>
      <Box direction="row">
        <Button id="members.mint" onClick={mint} look="secondary">
          {props.text.mint}
        </Button>
      </Box>
      <If when={shown.get() !== ""}>
        <Box direction="column" gap="2" p="3" bg="card" border="rule">
          <Text id="members.minted.note" fontSize="sm">
            {props.text.minted}
          </Text>
          <Box id="members.minted" p="2" bg="surfaceLow" font="mono" fontSize="sm">
            {shown.get()}
          </Box>
        </Box>
      </If>
      <If when={failed.get()}>
        <Text id="members.tokens.failed" look="notice" fg="error" border="error">
          {props.text.failed}
        </Text>
      </If>
      <If when={list.get().length === 0}>
        <Text id="members.tokens.none" fg="textSecondary" p="3" bg="card" border="hairline">
          {props.text.noTokens}
        </Text>
      </If>
      <Box
        as="ul"
        id="members.tokens.list"
        direction="column"
        gap="hairline"
        bg="divider"
        border="hairline"
        p="0"
        m="0"
      >
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
                look="secondary"
                fg="error"
                border="error"
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
