import type { Ctx } from "@keel/ctx";
import { type ResourceState, resource } from "@keel/reactive";
import { Case, For, Match, type Slots } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Heading, Text } from "@keel/ui";
import { Suggestion } from "./Suggestion.schema.ts";

export const Props = s.object({});

type State = ResourceState<Suggestion[]>;

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : "Suggestions failed");

async function fetchSuggestions(ctx: Ctx | undefined): Promise<Suggestion[]> {
  if (ctx === undefined) return Promise.reject(new Error("Suggestions need a ctx"));
  const res = await ctx.net.fetch(new Request("http://localhost/api/suggestions"));
  if (!res.ok) return Promise.reject(new Error(`Suggestions failed (${res.status})`));
  const body: unknown = await res.json();
  const items: unknown[] = Array.isArray(body) ? body : [];
  return items.flatMap((x) => {
    const r = Suggestion.parse(x);
    return r.ok ? [r.value] : [];
  });
}

/** Suggested titles from `GET /api/suggestions` through `ctx.net`, shown by resource state. */
export default function Suggestions(_props: Infer<typeof Props>, _slots?: Slots, ctx?: Ctx) {
  const list = resource(() => fetchSuggestions(ctx));
  return (
    <Box as="section" id="todos.suggestions" gap="1">
      <Heading id="todos.suggestions.title" level={2}>
        Suggestions
      </Heading>
      <Match on={list.get()}>
        <Case<State> tag="loading">
          {() => (
            <Text id="todos.suggestions.loading" as="p">
              Loading suggestions
            </Text>
          )}
        </Case>
        <Case<State> tag="error">
          {(v) => (
            <Text id="todos.suggestions.error" as="p" fg="danger">
              {messageOf(v.error)}
            </Text>
          )}
        </Case>
        <Case<State> tag="ready">
          {(v) => (
            <Box as="ul" id="todos.suggestions.list">
              <For each={v.value} key="title">
                {(item) => <Box as="li">{item.title}</Box>}
              </For>
            </Box>
          )}
        </Case>
      </Match>
    </Box>
  );
}
