import type { Ctx } from "@keel/ctx";
import { type ResourceState, resource } from "@keel/reactive";
import { Case, For, If, Match } from "@keel/runtime-dom";
import { type Infer, defect, s } from "@keel/schema";
import type { ApiError } from "@keel/services";
import { Box, Heading, Text } from "@keel/ui";
import type { Suggestion } from "../api/Suggestion.schema.ts";
import { todosApi } from "./todosApi.ts";

export const Props = s.object({});

type State = ResourceState<Suggestion[]>;

/** `api.status` names the HTTP status, which the defect carries in its `data`; any other failure only that it failed. */
const messageOf = (e: unknown): string => {
  const status: unknown = e instanceof Error ? Reflect.get(Object(Reflect.get(e, "data")), "status") : undefined;
  return typeof status === "number" ? `Suggestions failed (${status})` : "Suggestions failed";
};

const statusOf = (e: ApiError): { readonly status: number } | undefined =>
  e.code === "api.status" ? { status: e.data.status } : undefined;

async function fetchSuggestions(ctx: Ctx): Promise<Suggestion[]> {
  const r = await todosApi.suggestions({}, ctx);
  return r.ok ? r.value : defect("Suggestions failed", { data: statusOf(r.error) ?? {}, cause: r.error });
}

/** Suggested titles from `GET /api/suggestions` through the typed `api` client, shown by resource state. */
export default function Suggestions(_props: Infer<typeof Props>, ctx: Ctx) {
  const list = resource(() => fetchSuggestions(ctx));
  return (
    <Box as="section" id="todos.suggestions" direction="column" gap="3">
      <Heading id="todos.suggestions.title" level={2} fontSize="xl" m="0">
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
            <If
              when={v.value.length > 0}
              fallback={() => (
                <Text id="todos.suggestions.empty" as="p" m="0" font="mono" fontSize="sm" fg="textSecondary">
                  No suggestions right now.
                </Text>
              )}
            >
              {() => (
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
            </If>
          )}
        </Case>
      </Match>
    </Box>
  );
}
