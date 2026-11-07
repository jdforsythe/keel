import { For } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Heading, Text } from "@keel/ui";
import { A11yEntry } from "./A11yEntry.schema.ts";
import { IdEntry } from "./IdEntry.schema.ts";

export const Props = s.object({ ids: s.record(IdEntry), a11y: s.record(A11yEntry) });

/** Every element id with its source location and the a11y expectation (role, name source) the compiler recorded. */
export default function IdsView(props: Infer<typeof Props>) {
  const rows = () =>
    Object.keys(props.ids)
      .sort()
      .map((id) => {
        const e = props.ids[id];
        const a = props.a11y[id];
        const where = e === undefined ? "" : `${e.tag} in ${e.component} ${e.file}:${e.line}:${e.col}`;
        const expected = a === undefined ? "no a11y entry" : `${a.role ?? "no role"}, name from ${a.name}`;
        return { id, text: `${id}: ${where}; ${expected}` };
      });
  return (
    <Box as="section" id="inspector.ids" direction="column" gap="4">
      <Heading id="inspector.ids.title" level={2} fontSize="xl" weight="semibold" m="0">
        Ids and a11y
      </Heading>
      <Text as="p" id="inspector.ids.counts" m="0" font="mono" fontSize="sm" fg="textSecondary">
        {`${Object.keys(props.ids).length} ids, ${Object.keys(props.a11y).length} a11y expectations`}
      </Text>
      <Box as="ul" id="inspector.ids.list" direction="column" gap="hairline" bg="divider" border="hairline" p="0" m="0">
        <For each={rows()} key="id">
          {(r) => (
            <Box as="li" id={`inspector.id.${r.id}`} direction="row" px="3" py="2" bg="card" font="mono" fontSize="sm">
              {r.text}
            </Box>
          )}
        </For>
      </Box>
    </Box>
  );
}
