import type { Ctx } from "@keel/ctx";
import { type ResourceState, resource } from "@keel/reactive";
import { Case, For, Match, type Slots } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { type ApiError, service } from "@keel/services";
import { Box, Heading, Text } from "@keel/ui";
import type { Suggestion } from "../api/Suggestion.schema.ts";
import { suggestions } from "./suggestions.service.ts";

export const Props = s.object({});

type State = ResourceState<Suggestion[]>;

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : "Suggestions failed");

/** `api.status` names the HTTP status; any other ApiError (network, timeout, decode) only that it failed. */
const failure = (e: ApiError): Error =>
  new Error(e.code === "api.status" ? `Suggestions failed (${e.data.status})` : "Suggestions failed");

async function fetchSuggestions(ctx: Ctx | undefined): Promise<Suggestion[]> {
  if (ctx === undefined) return Promise.reject(new Error("Suggestions need a ctx"));
  const r = await service({ module: "api", schema: suggestions }).list({}, ctx);
  return r.ok ? r.value : Promise.reject(failure(r.error));
}

/** Suggested titles from `GET /api/suggestions` through a typed `suggestions` client, shown by resource state. */
export default function Suggestions(_props: Infer<typeof Props>, _slots?: Slots, ctx?: Ctx) {
  const list = resource(() => fetchSuggestions(ctx));
  return (
    <Box as="section" id="todos.suggestions" direction="column" gap="3">
      <Heading id="todos.suggestions.title" level={2} fontSize="xl" weight="semibold" m="0">
        Suggestions
      </Heading>
      <Match on={list.get()}>
        <Case<State> tag="loading">
          {() => (
            <Text id="todos.suggestions.loading" as="p" m="0" font="mono" fontSize="sm" fg="textSecondary">
              Loading suggestions
            </Text>
          )}
        </Case>
        <Case<State> tag="error">
          {(v) => (
            <Text id="todos.suggestions.error" as="p" m="0" font="mono" fontSize="sm" fg="error">
              {messageOf(v.error)}
            </Text>
          )}
        </Case>
        <Case<State> tag="ready">
          {(v) => (
            <Box
              as="ul"
              id="todos.suggestions.list"
              direction="column"
              gap="hairline"
              bg="divider"
              border="hairline"
              p="0"
              m="0"
            >
              <For each={v.value} key="title">
                {(item) => (
                  <Box as="li" direction="row" px="3" py="2" bg="card">
                    {item.title}
                  </Box>
                )}
              </For>
            </Box>
          )}
        </Case>
      </Match>
    </Box>
  );
}
