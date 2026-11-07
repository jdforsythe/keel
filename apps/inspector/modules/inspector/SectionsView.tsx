import { For } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Heading, Text } from "@keel/ui";
import { SectionView } from "./SectionView.schema.ts";

export const Props = s.object({ sections: s.record(SectionView) });

/**
 * Every inspector section a stdlib module registered (k.cli Inspector hooks), rendered generically: the id, the
 * schema's `doc()` as the type line, and the value as JSON text, or the E1057 the app reported for it.
 */
export default function SectionsView(props: Infer<typeof Props>) {
  const list = () =>
    Object.keys(props.sections)
      .sort()
      .map((id) => ({ id, ...(props.sections[id] ?? { doc: "", text: "", failed: false }) }));
  return (
    <Box as="section" id="inspector.sections" gap="1">
      <Heading id="inspector.sections.title" level={2}>
        Sections
      </Heading>
      <Text as="p" id="inspector.sections.count">
        {list().length === 0 ? "No sections registered" : `${list().length} sections`}
      </Text>
      <For each={list()} key="id">
        {(sec) => (
          <Box as="section" id={`inspector.section.${sec.id}`} gap="1">
            <Heading id={`inspector.section.${sec.id}.title`} level={3}>
              {sec.id}
            </Heading>
            <Text as="p" id={`inspector.section.${sec.id}.doc`} fontSize="sm">
              {`Type: ${sec.doc}`}
            </Text>
            <Text as="p" id={`inspector.section.${sec.id}.value`} fontSize="sm">
              {sec.failed ? `Failed: ${sec.text}` : sec.text}
            </Text>
          </Box>
        )}
      </For>
    </Box>
  );
}
