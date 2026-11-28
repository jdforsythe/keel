import { signal } from "@keel/reactive";
import { For } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box } from "@keel/ui";
import { Part } from "@keel/ui/aria";
import type { ChartStyles } from "./ChartStyles.ts";
import { ChartText } from "./ChartText.schema.ts";
import { numbered } from "./numbered.ts";
import { Point } from "./Point.schema.ts";

export const Props = s.object({ id: s.string(), label: s.string({ min: 1 }), points: s.array(Point), text: ChartText });

/**
 * A chart's values as a table, behind a button (the disclosure pattern): `<id>.button` shows and hides
 * `<id>.table`, which a screen reader, a keyboard and a person who cannot tell the marks apart all read the same way.
 * Each row is a value's `name` and its `shown`. `Part` takes its children as a thunk, so each passes `children`.
 */
export default function ChartNumbers(props: Infer<typeof Props> & { readonly styles?: ChartStyles | undefined }) {
  const open = signal(false);
  return (
    <Box id={`${props.id}.numbers`}>
      <Part
        {...props.styles?.button}
        id={`${props.id}.button`}
        role="button"
        expanded={open.get()}
        controls={`${props.id}.table`}
        onClick={() => open.set(!open.get())}
        children={() => props.text.numbers}
      />
      <Part
        {...props.styles?.table}
        id={`${props.id}.table`}
        role="table"
        label={props.label}
        hidden={!open.get()}
        children={() => [
          <Part
            id={`${props.id}.head`}
            role="rowgroup"
            head
            children={() => (
              <Part
                id={`${props.id}.head.row`}
                role="row"
                children={() => [
                  <Part id={`${props.id}.head.name`} role="columnheader" children={() => props.text.name} />,
                  <Part id={`${props.id}.head.value`} role="columnheader" children={() => props.text.value} />,
                ]}
              />
            )}
          />,
          <Part
            id={`${props.id}.rows`}
            role="rowgroup"
            children={() => (
              <For each={numbered(props.points)} key="at">
                {(point) => (
                  <Part
                    id={`${props.id}.row.${point.at}`}
                    role="row"
                    children={() => [
                      <Part id={`${props.id}.row.${point.at}.name`} role="rowheader" children={() => point.name} />,
                      <Part id={`${props.id}.row.${point.at}.value`} role="cell" children={() => point.shown} />,
                    ]}
                  />
                )}
              </For>
            )}
          />,
        ]}
      />
    </Box>
  );
}
