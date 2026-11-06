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
  // `<Match>`/`<Case>` JSX does not type-check (Case returns a CaseNode, not a JSX element), so the runtime
  // call form is used. `on` stays a getter so only the match op tracks the resource, and `key` is explicit:
  // without it the wrapper reads `on` in this component's scope to infer it and the component re-renders.
  const children = (): Node =>
    Match<State>({
      key: "state",
      get on() {
        return list.get();
      },
      children: [
        Case<State>({
          tag: "loading",
          children: () => (
            <Text id="todos.suggestions.loading" as="p">
              Loading suggestions
            </Text>
          ),
        }),
        Case<State>({
          tag: "error",
          children: (v) => (
            <Text id="todos.suggestions.error" as="p" fg="danger">
              {v.state === "error" ? messageOf(v.error) : ""}
            </Text>
          ),
        }),
        Case<State>({
          tag: "ready",
          children: (v) => (
            <Box as="ul" id="todos.suggestions.list">
              <For each={v.state === "ready" ? v.value : []} key="title">
                {(item) => <Box as="li">{item.title}</Box>}
              </For>
            </Box>
          ),
        }),
      ],
    });
  return (
    <Box as="section" id="todos.suggestions" gap="1">
      <Heading id="todos.suggestions.title" level={2}>
        Suggestions
      </Heading>
      {children()}
    </Box>
  );
}
Suggestions.Props = Props;
