import { For } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Heading, Text } from "@keel/ui";
import { StoreView } from "./StoreView.schema.ts";

export const Props = s.object({ stores: s.record(StoreView) });

/**
 * Every live store: its state as JSON and its log oldest first. The last entry carries the undo marker: it is the
 * one `undo()` reverts.
 */
export default function StoresView(props: Infer<typeof Props>) {
  const list = () =>
    Object.keys(props.stores)
      .sort()
      .map((id) => {
        const st = props.stores[id] ?? { state: "", log: [] };
        const last = st.log[st.log.length - 1]?.id;
        return { id, state: st.state, log: st.log.map((e) => ({ ...e, undo: e.id === last })) };
      });
  return (
    <Box as="section" id="inspector.stores" direction="column" gap="4">
      <Heading id="inspector.stores.title" level={2} fontSize="xl" weight="semibold" m="0">
        Stores
      </Heading>
      <For each={list()} key="id">
        {(st) => (
          <Box as="section" id={`inspector.store.${st.id}`} direction="column" gap="2">
            <Heading id={`inspector.store.${st.id}.title`} level={3} font="mono" fontSize="sm" weight="semibold" m="0">
              {st.id}
            </Heading>
            <Text
              as="p"
              id={`inspector.store.${st.id}.state`}
              m="0"
              p="3"
              bg="surfaceLow"
              fg="text"
              font="mono"
              fontSize="sm"
            >
              {st.state}
            </Text>
            <Text as="p" id={`inspector.store.${st.id}.count`} m="0" font="mono" fontSize="sm" fg="textSecondary">
              {st.log.length === 0 ? "Log empty: nothing to undo" : `Log: ${st.log.length} entries`}
            </Text>
            <Box
              as="ul"
              id={`inspector.store.${st.id}.log`}
              direction="column"
              gap="hairline"
              bg="divider"
              border="hairline"
              p="0"
              m="0"
            >
              <For each={st.log} key="id">
                {(e) => (
                  <Box
                    as="li"
                    id={`inspector.store.${st.id}.entry.${e.id}`}
                    direction="row"
                    px="3"
                    py="2"
                    bg="card"
                    font="mono"
                    fontSize="sm"
                    fg={e.undo ? "accent" : "text"}
                  >
                    {e.undo ? `${e.id} ${e.name} at ${e.at} (undo reverts this)` : `${e.id} ${e.name} at ${e.at}`}
                  </Box>
                )}
              </For>
            </Box>
          </Box>
        )}
      </For>
    </Box>
  );
}
